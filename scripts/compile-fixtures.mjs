import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

const compiler = resolve(process.env.PJSX_ROOT ?? "../pjsx");
const binary = resolve(compiler, "zig-out/bin/pjsx");
const run = (file, args, cwd = process.cwd()) =>
  execFileSync(file, args, { cwd, stdio: "inherit" });
for (const directory of ["tests/fixtures", "tests/compiled"]) {
  const files = readdirSync(directory)
    .filter((name) => name.endsWith(".ptsx"))
    .sort()
    .map((name) => `${directory}/${name}`);
  run(binary, ["dom", ...files, "--out", directory]);
}
for (const name of [
  "Counter",
  "Users",
  "Pair",
  "InputRoot",
  "TableRow",
  "Fragments",
  "Helpers",
  "HelperRoot",
  "Overlay",
  "Metadata",
  "Hello",
]) {
  const file = `tests/compiled/${name}.ptsx`;
  run(binary, ["dom-zig", file, "--out", "tests/compiled"]);
  run(binary, ["dom-behavior", file, "--out", "tests/compiled"]);
}
run(
  "zig",
  ["build", "test", `-Druntime=${compiler}/src/runtime/compiled.zig`, "--summary", "failures"],
  resolve("tests/compiled"),
);

// The default native target is tested separately from explicit DOM adoption.
run(process.execPath, ["scripts/compile-html-fixtures.mjs"]);
