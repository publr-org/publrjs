const std = @import("std");
pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const runtime = b.createModule(.{ .root_source_file = .{ .cwd_relative = b.option([]const u8, "runtime", "Compiled runtime") orelse "../../pjsx/src/runtime/compiled.zig" }, .target = target });
    const root = b.createModule(.{ .root_source_file = b.path("main.zig"), .target = target, .imports = &.{.{ .name = "compiled_runtime", .module = runtime }} });
    b.installArtifact(b.addExecutable(.{ .name = "team-demo", .root_module = root }));
}
