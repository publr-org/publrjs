const rt = @import("compiled_runtime");
pub const Context = struct { calls: usize = 0, now_ms: i64 };
pub const Profile = struct { @"error": []const u8, isPending: []const u8, isError: i32, data: []const u8 };

pub fn profile(ctx: *Context) !Profile {
    ctx.calls += 1;
    return .{ .@"error" = "payload", .isPending = "field", .isError = 7, .data = "ordinary" };
}
pub fn scalar(ctx: *Context) !rt.OperationResult(?i32) {
    ctx.calls += 1;
    return .{ .value = null, .policy = .{ .expires = ctx.now_ms + 60000, .tags = &.{"scalar"} } };
}
