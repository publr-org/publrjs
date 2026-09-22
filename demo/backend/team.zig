const std = @import("std");
pub const Member = struct { id: f64, name: []const u8, role: []const u8, team: []const u8, initials: []const u8, hue: []const u8 };
pub const QueryPerson = struct { id: f64, name: []const u8 };
pub const Context = struct { arena: std.mem.Allocator, io: std.Io, initial: bool, now_ms: i64 = 0, query_additions: []const QueryPerson = &.{}, authorized: bool = true };
const members = [_]Member{
    .{ .id = 1, .name = "Ada Chen", .role = "Design engineer", .team = "Product", .initials = "AC", .hue = "peach" },
    .{ .id = 2, .name = "Elena Rossi", .role = "Product designer", .team = "Design", .initials = "ER", .hue = "lilac" },
    .{ .id = 3, .name = "Jules Martin", .role = "Frontend engineer", .team = "Engineering", .initials = "JM", .hue = "mint" },
    .{ .id = 4, .name = "Noah Williams", .role = "Research lead", .team = "Design", .initials = "NW", .hue = "sand" },
    .{ .id = 5, .name = "Priya Shah", .role = "Platform engineer", .team = "Engineering", .initials = "PS", .hue = "blue" },
    .{ .id = 6, .name = "Theo Park", .role = "Product manager", .team = "Product", .initials = "TP", .hue = "rose" },
};
pub fn fetchMembers(ctx: *Context, query: []const u8, reversed: bool, failing: bool, delay: f64) ![]const Member {
    if (!ctx.authorized) return error.Unauthorized;
    if (!ctx.initial) try std.Io.sleep(ctx.io, .fromMilliseconds(@intFromFloat(std.math.clamp(delay, 0, 2000))), .awake);
    if (failing) return error.SimulatedFailure;
    const needle = try std.ascii.allocLowerString(ctx.arena, query);
    var result: std.ArrayList(Member) = .empty;
    for (members) |member| {
        const haystack = try std.fmt.allocPrint(ctx.arena, "{s} {s} {s}", .{member.name, member.role, member.team});
        if (std.mem.indexOf(u8, try std.ascii.allocLowerString(ctx.arena, haystack), needle) != null) try result.append(ctx.arena, member);
    }
    if (reversed) std.mem.reverse(Member, result.items);
    return result.items;
}
pub fn summarize(ctx: *Context, people: []const Member) !struct { label: []const u8 } {
    if (!ctx.authorized) return error.Unauthorized;
    if (!ctx.initial) try std.Io.sleep(ctx.io, .fromMilliseconds(180), .awake);
    return .{ .label = try std.fmt.allocPrint(ctx.arena, "{d} profiles · summary ready", .{people.len}) };
}
