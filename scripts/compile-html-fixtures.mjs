import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
const compiler = resolve(process.env.PJSX_ROOT ?? "../pjsx");
execFileSync("zig", ["build", "--summary", "failures"], { cwd: compiler, stdio: "inherit" });
for (const name of [
  "Counter",
  "Users",
  "Pair",
  "StaticShell",
  "ShellOwner",
  "InputRoot",
  "TableRow",
  "Fragments",
  "Helpers",
  "HelperRoot",
  "Overlay",
  "ExplicitOverlay",
  "Metadata",
  "Hello",
  "Bindings",
]) {
  for (const target of ["zig", "behavior"])
    execFileSync(
      resolve(compiler, "zig-out/bin/pjsx"),
      [
        target,
        `tests/${name === "Bindings" ? "html" : "compiled"}/${name}.ptsx`,
        "--out",
        "tests/html",
      ],
      { stdio: "inherit" },
    );
}
execFileSync(
  "zig",
  ["build", "test", `-Druntime=${compiler}/src/runtime/compiled.zig`, "--summary", "failures"],
  { cwd: "tests/html", stdio: "inherit" },
);
