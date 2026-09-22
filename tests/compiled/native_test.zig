const std = @import("std");
const Users = @import("Users.zig");
const Pair = @import("Pair.zig");
const Counter = @import("Counter.zig");
const InputRoot = @import("InputRoot.zig");
const TableRow = @import("TableRow.zig");
const Fragments = @import("Fragments.zig");
const Backend = @import("backend/users.zig");
const rt = @import("compiled_runtime");
test "native JSON profile rejects lossy values and preserves scalar semantics" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const a = arena.allocator();
    try std.testing.expectError(error.InvalidJsonValue, rt.validate(.{ .float = std.math.nan(f64) }));
    try std.testing.expectError(error.InvalidJsonValue, rt.validate(.{ .float = -0.0 }));
    try std.testing.expectError(error.InvalidJsonValue, rt.validate(.{ .integer = 9007199254740993 }));
    try std.testing.expectError(error.MissingProperty, rt.get(.null, "missing"));
    try std.testing.expectEqual(@as(i64, 2), (try rt.get(.{ .string = "😀" }, "length")).integer);
    try std.testing.expect(!(try rt.binary(a, "===", .{ .string = "1" }, .{ .integer = 1 })).bool);
    try std.testing.expect((try rt.binary(a, "<", .{ .string = "10" }, .{ .string = "2" })).bool);
}
test "native SSR uses request authority, transfers safe JSON and exposes validated endpoints" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const a = arena.allocator();
    var out: std.Io.Writer.Allocating = .init(a);
    var ctx = Backend.Context{ .authorized = true };
    const props = try rt.object(a, &.{"search"}, &.{.{ .string = "Ada" }});
    try Users.render(&out.writer, a, &ctx, props, "users:1");
    try std.testing.expectEqual(@as(usize, 1), ctx.calls);
    try std.testing.expect(std.mem.indexOf(u8, out.written(), "Ada &lt;/script&gt; &amp; Co") != null);
    try std.testing.expect(std.mem.indexOf(u8, out.written(), "\\u003c/script\\u003e") != null);
    try std.Io.Dir.cwd().writeFile(std.testing.io, .{ .sub_path = "Users.html", .data = out.written() });
    out.clearRetainingCapacity();
    try Counter.render(&out.writer, a, &ctx, try rt.object(a, &.{"initial"}, &.{.{ .integer = 3 }}), "counter:1");
    try std.Io.Dir.cwd().writeFile(std.testing.io, .{ .sub_path = "Counter.html", .data = out.written() });
    out.clearRetainingCapacity();
    try std.testing.expectError(error.InvalidArguments, rt.native(Backend.fetchUsers, &ctx, a, &.{}));
    try std.testing.expectError(error.UnexpectedToken, rt.native(Backend.fetchUsers, &ctx, a, &.{.{ .bool = false }}));
    out.clearRetainingCapacity();
    try Pair.render(&out.writer, a, &ctx, .null, "pair:1");
    try std.Io.Dir.cwd().writeFile(std.testing.io, .{ .sub_path = "Pair.html", .data = out.written() });
    out.clearRetainingCapacity();
    try std.testing.expect(try Users.writeTypes(&out.writer, "./backend/users.zig"));
    try std.Io.Dir.cwd().writeFile(std.testing.io, .{ .sub_path = "backend/users.d.zig.ts", .data = out.written() });
    out.clearRetainingCapacity();
    const args = try rt.array(a, &.{.{ .string = "query" }});
    try std.testing.expect(try Users.dispatch(&out.writer, a, &ctx, Users.operations[0].path, args));
    try std.testing.expectEqual(@as(usize, 2), ctx.calls);
    try std.testing.expectError(error.InvalidArguments, Users.dispatch(&out.writer, a, &ctx, Users.operations[0].path, try rt.array(a, &.{})));
    try std.testing.expect(!(try Users.dispatch(&out.writer, a, &ctx, "/not-exposed", args)));
    ctx.authorized = false;
    try std.testing.expectError(error.Unauthorized, Users.dispatch(&out.writer, a, &ctx, Users.operations[0].path, args));
    try std.testing.expectError(error.Unauthorized, Users.render(&out.writer, a, &ctx, props, "users:2"));
}

test "root elements carry their own state and only root fragments introduce an element" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const a = arena.allocator();
    var out: std.Io.Writer.Allocating = .init(a);
    var ctx = Backend.Context{ .authorized = true };
    try InputRoot.render(&out.writer, a, &ctx, try rt.object(a, &.{"initial"}, &.{.{ .string = "\"<&</script>" }}), "input:1");
    try std.testing.expect(std.mem.startsWith(u8, out.written(), "<input "));
    try std.testing.expect(std.mem.indexOf(u8, out.written(), "<script") == null);
    try std.testing.expect(std.mem.indexOf(u8, out.written(), "p-island") == null);
    try std.Io.Dir.cwd().writeFile(std.testing.io, .{ .sub_path = "InputRoot.html", .data = out.written() });
    out.clearRetainingCapacity();
    try TableRow.render(&out.writer, a, &ctx, .null, "row:1");
    try std.testing.expect(std.mem.startsWith(u8, out.written(), "<tr "));
    try std.Io.Dir.cwd().writeFile(std.testing.io, .{ .sub_path = "TableRow.html", .data = out.written() });
    out.clearRetainingCapacity();
    try Fragments.render(&out.writer, a, &ctx, .null, "fragments:1");
    try std.testing.expect(std.mem.startsWith(u8, out.written(), "<p-fragment style=\"display:contents\""));
    try std.testing.expect(std.mem.indexOf(u8, out.written(), "<!--p:fragment-->") != null);
    try std.Io.Dir.cwd().writeFile(std.testing.io, .{ .sub_path = "Fragments.html", .data = out.written() });
}

test "helpers render backend rows with filtering, windows and guarded branches" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const a = arena.allocator();
    var out: std.Io.Writer.Allocating = .init(a);
    const rows = try rt.array(a, &.{
        try rt.object(a, &.{"id", "name"}, &.{.{.integer = 1}, .{.string = "First"}}),
        try rt.object(a, &.{"id", "name"}, &.{.{.integer = 2}, .{.string = "Second"}}),
    });
    try @import("Helpers.zig").render(&out.writer, a, .{}, try rt.object(a, &.{"rows"}, &.{rows}), "helpers:1");
    try std.testing.expect(std.mem.indexOf(u8, out.written(), "First") != null);
    try std.Io.Dir.cwd().writeFile(std.testing.io, .{ .sub_path = "Helpers.html", .data = out.written() });
}

test "structural helper roots use parser-safe template anchors" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const a = arena.allocator();
    var out: std.Io.Writer.Allocating = .init(a);
    try @import("HelperRoot.zig").render(&out.writer, a, .{}, .null, "root:1");
    try std.testing.expect(std.mem.startsWith(u8, out.written(), "<template data-p-root-start"));
    try std.Io.Dir.cwd().writeFile(std.testing.io, .{ .sub_path = "HelperRoot.html", .data = out.written() });
}

test "overlay begins as static HTML with client-only refs and effects deferred" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const a = arena.allocator();
    var out: std.Io.Writer.Allocating = .init(a);
    try @import("Overlay.zig").render(&out.writer, a, .{}, .null, "overlay:1");
    try std.testing.expect(std.mem.indexOf(u8, out.written(), "<aside") == null);
    try std.Io.Dir.cwd().writeFile(std.testing.io, .{ .sub_path = "Overlay.html", .data = out.written() });
}

test "metadata collisions and cache freshness transfer preserve native payloads" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const a = arena.allocator();
    var out: std.Io.Writer.Allocating = .init(a);
    const ms: i64 = @intCast(@divTrunc(std.Io.Clock.real.now(std.testing.io).nanoseconds, std.time.ns_per_ms));
    var ctx = @import("backend/metadata.zig").Context{ .now_ms = ms };
    try @import("Metadata.zig").render(&out.writer, a, &ctx, .null, "metadata:1");
    try std.testing.expectEqual(@as(usize, 2), ctx.calls);
    try std.testing.expect(std.mem.indexOf(u8, out.written(), "payload") != null);
    try std.Io.Dir.cwd().writeFile(std.testing.io, .{ .sub_path = "Metadata.html", .data = out.written() });
    out.clearRetainingCapacity();
    try std.testing.expect(try @import("Metadata.zig").writeTypes(&out.writer, "./backend/metadata.zig"));
    try std.Io.Dir.cwd().writeFile(std.testing.io, .{ .sub_path = "backend/metadata.d.zig.ts", .data = out.written() });
}

test "a static Hello template is useful without component JavaScript" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const a = arena.allocator();
    var out: std.Io.Writer.Allocating = .init(a);
    try @import("Hello.zig").render(&out.writer, a, .{}, .null, "hello:1");
    try std.testing.expect(std.mem.indexOf(u8, out.written(), ">Hello</button>") != null);
    try std.testing.expect(std.mem.indexOf(u8, out.written(), "<script") == null);
    try std.Io.Dir.cwd().writeFile(std.testing.io, .{ .sub_path = "Hello.html", .data = out.written() });
}
