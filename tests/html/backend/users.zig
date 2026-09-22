const std = @import("std");
pub const User = struct { id: f64, name: []const u8 };
pub const Context = struct { authorized: bool, calls: usize = 0 };
pub fn fetchUsers(ctx: *Context, search: []const u8) ![]const User {
    ctx.calls += 1;
    if (!ctx.authorized) return error.Unauthorized;
    _ = search;
    return &.{.{ .id = 1, .name = "Ada </script> & Co" }};
}
