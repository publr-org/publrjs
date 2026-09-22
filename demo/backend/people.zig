const std = @import("std");
const Context = @import("team.zig").Context;
pub const Person = struct { id: f64, name: []const u8 };
const people = [_]Person{
    .{ .id = 1, .name = "Ada Chen" },
    .{ .id = 2, .name = "Elena Rossi" },
    .{ .id = 3, .name = "Jules Martin" },
};
pub fn findPeople(ctx: *Context, search: []const u8) ![]const Person {
    if (!ctx.authorized) return error.Unauthorized;
    const needle = try std.ascii.allocLowerString(ctx.arena, search);
    var result: std.ArrayList(Person) = .empty;
    for (people) |person| {
        const name = try std.ascii.allocLowerString(ctx.arena, person.name);
        if (std.mem.indexOf(u8, name, needle) != null) try result.append(ctx.arena, person);
    }
    return result.items;
}
