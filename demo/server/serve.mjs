import { chapters } from "../chapters/catalog.ts";
import { demoRoot, demoFile } from "../paths.mjs";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { lessons, lessonMarkup, sourceFiles, escapeHTML } from "./lessons.mjs";
import { createRequestGates } from "./request-gates.mjs";
import { createQueryData } from "./query-data.mjs";
const queryData = createQueryData();
const gates = createRequestGates();
const run = promisify(execFile);
const root = demoRoot;
const native = demoFile("zig-out/bin/team-demo");
const server = createServer(async (request, response) => {
  const send = (type, content, cacheControl = "no-store") =>
    response
      .writeHead(200, {
        "Content-Type": type,
        "Cache-Control": cacheControl,
        "X-Content-Type-Options": "nosniff",
      })
      .end(content);
  try {
    const url = new URL(request.url, "http://localhost");
    const peopleLesson = /^\/learn\/query(?:\/|$)/.test(url.pathname)
      ? "query"
      : url.pathname.startsWith("/learn/failure")
        ? "failure"
        : "awaited";
    if (url.pathname === `/learn/${peopleLesson}/control` && request.method === "POST") {
      gates.control(url.searchParams.get("id"), url.searchParams.get("action"));
      if (peopleLesson === "query" && url.searchParams.get("action") === "dispose")
        queryData.dispose(url.searchParams.get("id"));
      send("application/json", "{}");
      return;
    }
    if (url.pathname === "/learn/query/add" && request.method === "POST") {
      const referrer = new URL(request.headers.referer ?? "/", "http://localhost");
      const person =
        referrer.pathname === "/learn/query/frame"
          ? queryData.add(referrer.searchParams.get("id"))
          : null;
      if (!person) {
        response
          .writeHead(410, { "Content-Type": "application/json", "Cache-Control": "no-store" })
          .end(JSON.stringify({ error: "This preview ended. Reload it to add a person." }));
      } else send("application/json", JSON.stringify(person));
      return;
    }
    if (url.pathname.startsWith("/_publr/") && request.method === "POST") {
      let body = "";
      for await (const chunk of request) {
        body += chunk;
        if (body.length > 65536) {
          response.writeHead(413).end();
          return;
        }
      }
      const referrer = new URL(request.headers.referer ?? "/", "http://localhost");
      const fixture =
        referrer.pathname === "/learn/failure/frame"
          ? gates.begin(referrer.searchParams.get("id"))
          : {};
      const wait =
        url.pathname.endsWith("/findPeople") || url.pathname.endsWith("/readPeople")
          ? gates.wait(
              ["/learn/awaited/frame", "/learn/failure/frame", "/learn/query/frame"].includes(
                referrer.pathname,
              )
                ? referrer.searchParams.get("id")
                : null,
              response,
              fixture.slow ? 2400 : 800,
            )
          : Promise.resolve();
      const args = ["call", url.pathname, body];
      if (url.pathname.endsWith("/readPeople")) {
        args.push(
          JSON.stringify(
            queryData.snapshot(
              referrer.pathname === "/learn/query/frame" ? referrer.searchParams.get("id") : null,
            ),
          ),
        );
      }
      const [{ stdout }] = await Promise.all([run(native, args, { maxBuffer: 1 << 20 }), wait]);
      if (!response.destroyed) {
        if (fixture.takeFailure?.())
          response
            .writeHead(503, { "Content-Type": "application/json", "Cache-Control": "no-store" })
            .end(JSON.stringify({ error: "The people API is unavailable. Try again." }));
        else
          send(
            "application/json",
            stdout,
            url.pathname.endsWith("/readPeople") ? "private, max-age=60" : "no-store",
          );
      }
      return;
    }
    if (request.method !== "GET") {
      response.writeHead(405).end();
      return;
    }
    const chapterRoute = /^\/learn\/([^/]+)(?:\/(frame|preview))?$/.exec(url.pathname);
    const chapterID = chapterRoute?.[1];
    const chapter = chapters[chapterID];
    const shared = chapterID === "shared-state";
    if (chapter || shared) {
      const operation = chapterRoute[2];
      if (operation === "frame") {
        if (["awaited", "failure", "query"].includes(chapterID)) {
          const id = url.searchParams.get("id");
          if (!id || !/^[a-f0-9-]{36}$/.test(id)) {
            response.writeHead(400).end();
            return;
          }
          gates.create(id, url.searchParams.get("controlled") === "1");
          if (chapterID === "query") queryData.create(id);
        } else if (!["focus", "position", "portals"].includes(chapterID)) {
          response.writeHead(404).end("Not found");
          return;
        }
        send(
          "text/html; charset=utf-8",
          await readFile(demoFile(`${chapterID}-frame.html`), "utf8"),
        );
        return;
      }
      const command = shared ? "shared-state" : chapter.command;
      if (operation === "preview") {
        const html =
          url.searchParams.get("target") === "csr"
            ? '<div id="app"></div>'
            : chapterID === "composition"
              ? await readFile(demoFile("StaticPage.html"), "utf8")
              : (await run(native, [command])).stdout;
        send("text/html; charset=utf-8", html);
        return;
      }
      const [template, source, result] = await Promise.all([
        readFile(demoFile(`${chapterID}.html`), "utf8"),
        readFile(demoFile(shared ? "SharedCounter.ptsx" : chapter.source), "utf8"),
        run(native, [shared ? "state" : command]),
      ]);
      const values = {
        SOURCE: escapeHTML(source).replace(
          /\b(export|function|return|string)\b/g,
          '<span class="code-keyword">$1</span>',
        ),
        GREETING:
          chapterID === "composition"
            ? await readFile(demoFile("StaticPage.html"), "utf8")
            : chapterID === "effects"
              ? `<div data-p-activation="manual">${result.stdout}</div>`
              : result.stdout,
      };
      send(
        "text/html; charset=utf-8",
        template.replace(/<!--(SOURCE|GREETING)-->/g, (_, key) => values[key]),
      );
      return;
    }
    if (url.pathname.startsWith("/source/")) {
      const file = url.pathname.slice("/source/".length);
      if (!["TemplateGreeting.ptsx", "Hello.ptsx"].includes(file) && !sourceFiles.has(file)) {
        response.writeHead(404).end("Source not found");
        return;
      }
      send("text/plain; charset=utf-8", await readFile(demoFile(file)));
      return;
    }
    if (
      [
        "/style.css",
        "/learn.css",
        "/introduction.css",
        "/awaited.css",
        "/portals.css",
        "/position.css",
        "/focus.css",
        "/theme.css",
        "/effects-frame.css",
      ].includes(url.pathname)
    ) {
      send("text/css", await readFile(demoFile("dist/" + url.pathname.slice(1))));
      return;
    }
    // Vite emits readable entry modules, lazy example chunks, and source maps.
    const assets = await readdir(demoFile("dist"));
    const asset = url.pathname.slice(1);
    if (assets.includes(asset) && /\.js(?:\.map)?$/.test(asset)) {
      send(
        asset.endsWith(".map") ? "application/json" : "text/javascript",
        await readFile(resolve(root, "dist", asset)),
      );
      return;
    }
    const lessonID =
      url.pathname === "/"
        ? "ssr"
        : url.pathname === "/learn/query-lab"
          ? "query"
          : url.pathname.split("/")[2];
    const lesson = lessons.find((item) => item.id === lessonID);
    const validLessonPath =
      url.pathname === "/" ||
      (lessonID === "navigation"
        ? ["/learn/navigation/a", "/learn/navigation/b"].includes(url.pathname)
        : url.pathname === (lesson?.path ?? `/learn/${lessonID}`));
    if (lesson && validLessonPath) {
      let example = "";
      if (lesson.id === "ssr") example = (await run(native, ["counter"])).stdout;
      if (lesson.id === "html") example = await readFile(demoFile("examples/counter.html"), "utf8");
      if (lesson.id === "navigation")
        example = (
          await run(native, ["navigation", url.pathname.endsWith("/b") ? "Page B" : "Page A"])
        ).stdout;
      const template = await readFile(demoFile("learn.html"), "utf8");
      send(
        "text/html; charset=utf-8",
        lessonMarkup(template, lesson, example, randomUUID().slice(0, 8), url.pathname),
      );
      return;
    }
    if (["/combined", "/combined/lab"].includes(url.pathname)) {
      const { stdout } = await run(native, ["render"], { maxBuffer: 1 << 20 });
      const template = await readFile(demoFile("index.html"), "utf8");
      send(
        "text/html; charset=utf-8",
        template.replace("<!--SSR-->", () => stdout),
      );
      return;
    }
    response.writeHead(404).end("Not found");
  } catch (error) {
    console.error(`Demo request failed: ${request.method} ${request.url}`, error);
    response
      .writeHead(500, { "Content-Type": "application/json" })
      .end(JSON.stringify({ error: "The demo request failed." }));
  }
});
const port = Number(process.env.PORT ?? 4173);
server.listen(port, "127.0.0.1", () => console.log(`Publr examples → http://localhost:${port}`));
