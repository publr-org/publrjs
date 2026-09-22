const std = @import("std");
pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const runtime = b.createModule(.{ .root_source_file = .{ .cwd_relative = b.option([]const u8, "runtime", "Compiled native runtime path") orelse "../../../pjsx/src/runtime/compiled.zig" }, .target = target });
    const root = b.createModule(.{ .root_source_file = b.path("native_test.zig"), .target = target, .imports = &.{.{ .name = "compiled_runtime", .module = runtime }} });
    const tests = b.addTest(.{ .root_module = root });
    b.step("test", "Execute generated native SSR and endpoints").dependOn(&b.addRunArtifact(tests).step);
}
