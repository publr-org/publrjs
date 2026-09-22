const std = @import("std");
const people = @import("people.zig");
const Context = @import("team.zig").Context;

pub fn readPeople(ctx: *Context, search: []const u8) ![]const people.Person {
    if (!ctx.authorized) return error.Unauthorized;
    var result: std.ArrayList(people.Person) = .empty;
    const needle = try std.ascii.allocLowerString(ctx.arena, search);
    for (ctx.query_additions) |person| {
        const name = try std.ascii.allocLowerString(ctx.arena, person.name);
        if (std.mem.indexOf(u8, name, needle) != null)
            try result.append(ctx.arena, .{ .id = person.id, .name = person.name });
    }
    try result.appendSlice(ctx.arena, try people.findPeople(ctx, search));
    return result.items;
}
