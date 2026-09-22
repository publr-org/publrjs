import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const directory = mkdtempSync(join(tmpdir(), "publr-authoring-"));
const checker = resolve("../pjsx/scripts/check-types.mjs");
const compiler = resolve("../pjsx/zig-out/bin/pjsx");
const positive = `import { Show as Visible, Switch, Match, For, Repeat, state, awaited, derived, valueOf } from "publr";
type Item = { kind: "person"; name: string } | { kind: "count"; count: number };
function load() { return { error: "payload", isPending: 3, isError: false }; }
export function Example(props: { item: Item | null }) {
  let item = state(props.item);
  const data = awaited(load());
  const copy = data;
  const payload: string = copy.error;
  const exact: string = valueOf(data).error;
  const pending: boolean = data.isPending;
  const bracket: boolean = data["isError"];
  const ready = derived(() => data);
  const failure: unknown = ready.error;
  return <Visible when={item} fallback={<i>{payload}</i>}>
    <Switch>
      <Match when={item.kind === "person"}><p>{item.name}</p></Match>
      <Match when={item.kind === "count"}><p>{item.count}</p></Match>
    </Switch>
    <Visible when={props.item !== null}>
      <Visible when={props.item.kind === "person"}><p>{props.item.name}</p></Visible>
    </Visible>
  </Visible>;
}`;
const negatives = [
  ["unguarded", `return <p>{user.name}</p>;`],
  ["fallback", `return <Show when={user} fallback={<p>{user.name}</p>}><p>{user.name}</p></Show>;`],
  [
    "delayed",
    `return <Show when={user}><button onClick={() => console.log(user.name)}>Go</button></Show>;`,
  ],
  ["wrong-member", `return <Show when={user}><p>{user.missing}</p></Show>;`],
  [
    "shadowed",
    `const Show = (props: { when: unknown; children: Node }) => props.children; return <Show when={user}><p>{user.name}</p></Show>;`,
  ],
  [
    "unstable",
    `const read = (): { name: string } | null => null; return <Show when={read()}><p>{read().name}</p></Show>;`,
  ],
  ["attribute", `return <Show when={user} keyed="yes"><p>{user.name}</p></Show>;`],
  ["object-key", `return <For each={[{ id: 1 }]}>{(row) => <p>{row.id}</p>}</For>;`],
];
try {
  const good = join(directory, "Good.ptsx");
  writeFileSync(good, positive);
  const checked = spawnSync(process.execPath, [checker, good], { encoding: "utf8" });
  assert.equal(checked.status, 0, checked.stdout + checked.stderr);
  const compiled = spawnSync(compiler, ["dom", good], { encoding: "utf8" });
  assert.equal(compiled.status, 0, compiled.stderr);
  for (const [name, body] of negatives) {
    const file = join(directory, name + ".ptsx");
    writeFileSync(
      file,
      `import { Show, For, state } from "publr";\nexport function Example() {\n  let user = state<{ name: string } | null>(null);\n  ${body}\n}\n`,
    );
    const result = spawnSync(process.execPath, [checker, file], { encoding: "utf8" });
    assert.notEqual(result.status, 0, name + " was incorrectly accepted");
    assert(
      result.stderr.includes(file + ":4"),
      name + " diagnostic lost authored location: " + result.stderr,
    );
    assert(!result.stderr.includes(".ptsx.tsx"), "virtual source location escaped");
  }
  for (const expression of ["data.error = 1", "data[key]"]) {
    const file = join(directory, "Unsupported.ptsx");
    writeFileSync(
      file,
      `import {awaited} from "publr"; function load(){ return {}; } function Example(){ const data = awaited(load()); const key = "x"; ${expression}; return <p/>; }`,
    );
    assert.notEqual(spawnSync(compiler, ["dom", file], { encoding: "utf8" }).status, 0);
  }
  for (const helper of ["For", "Repeat"]) {
    const file = join(directory, "ImmutableRow.ptsx");
    writeFileSync(
      file,
      `import {${helper}} from "publr"; export function Example() { return <${helper} ${helper === "For" ? "each={[1]}" : "count={1}"}>{(index) => { index++; return <p>{index}</p>; }}</${helper}>; }`,
    );
    const result = spawnSync(compiler, ["dom", file], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert(result.stderr.includes("iteration parameters are read-only"));
  }
  console.log(
    "Authoring acceptance: payload metadata, guarded narrowing, lexical identity, delayed callbacks and authored diagnostic lines passed.",
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
