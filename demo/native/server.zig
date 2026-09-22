const std = @import("std");
const SharedCounter = @import("../.generated/components/SharedCounter.zig");
const StaticPage = @import("../.generated/components/StaticPage.zig");
const ResilientSearch = @import("../.generated/components/ResilientSearch.zig");
const PeopleReader = @import("../.generated/components/PeopleReader.zig");
const SharedPeople = @import("../.generated/components/SharedPeople.zig");
const PeopleSearch = @import("../.generated/components/PeopleSearch.zig");
const ReuseDemo = @import("../.generated/components/ReuseDemo.zig");
const PropsDemo = @import("../.generated/components/PropsDemo.zig");
const TimerDemo = @import("../.generated/components/TimerDemo.zig");
const FocusDetails = @import("../.generated/components/FocusDetails.zig");
const AnchoredDetails = @import("../.generated/components/AnchoredDetails.zig");
const PersonDetails = @import("../.generated/components/PersonDetails.zig");
const FocusInput = @import("../.generated/components/FocusInput.zig");
const StatusMessage = @import("../.generated/components/StatusMessage.zig");
const NameInput = @import("../.generated/components/NameInput.zig");
const ItemList = @import("../.generated/components/ItemList.zig");
const ConditionalMessage = @import("../.generated/components/ConditionalMessage.zig");
const EffectCounter = @import("../.generated/components/EffectCounter.zig");
const DerivedCounter = @import("../.generated/components/DerivedCounter.zig");
const StateCounter = @import("../.generated/components/StateCounter.zig");
const Hello = @import("../.generated/components/Hello.zig");
const TemplateGreeting = @import("../.generated/components/TemplateGreeting.zig");
const Desk = @import("../.generated/components/Desk.zig");
const SimpleCounter = @import("../.generated/components/SimpleCounter.zig");
const NavigationPage = @import("../.generated/components/NavigationPage.zig");
const AsyncExample = @import("../.generated/components/AsyncExample.zig");
const Backend = @import("../backend/team.zig");
const rt = @import("compiled_runtime");
pub fn main(init: std.process.Init) !void {
    const arena = init.arena.allocator();
    const args = try init.minimal.args.toSlice(arena);
    if (args.len < 2) return error.MissingCommand;
    var out: std.Io.Writer.Allocating = .init(arena);
    var ctx = Backend.Context{ .arena = arena, .io = init.io, .now_ms = @intCast(@divTrunc(std.Io.Clock.real.now(init.io).nanoseconds, std.time.ns_per_ms)), .initial = std.mem.eql(u8, args[1], "render") };
    if (std.mem.eql(u8, args[1], "hello")) {
        try Hello.render(&out.writer, arena, &ctx, try rt.object(arena, &.{}, &.{}), "hello-button");
    } else if (std.mem.eql(u8, args[1], "shared-state")) {
        try SharedCounter.render(&out.writer, arena, &ctx, try rt.object(arena, &.{}, &.{}), "shared-counter");
    } else if (std.mem.eql(u8, args[1], "composition")) {
        try StaticPage.render(&out.writer, arena, &ctx, try rt.object(arena, &.{}, &.{}), "static-page");
    } else if (std.mem.eql(u8, args[1], "query")) {
        try SharedPeople.render(&out.writer, arena, &ctx, .null, "shared-people");
    } else if (std.mem.eql(u8, args[1], "query-types")) {
        if (!(try PeopleReader.writeTypes(&out.writer, "../../backend/queries.zig"))) return error.NoTypes;
    } else if (std.mem.eql(u8, args[1], "failure")) {
        try ResilientSearch.render(&out.writer, arena, &ctx, .null, "resilient-search");
    } else if (std.mem.eql(u8, args[1], "awaited")) {
        try PeopleSearch.render(&out.writer, arena, &ctx, .null, "people-search");
    } else if (std.mem.eql(u8, args[1], "people-types")) {
        if (!(try PeopleSearch.writeTypes(&out.writer, "../../backend/people.zig"))) return error.NoTypes;
    } else if (std.mem.eql(u8, args[1], "reuse")) {
        try ReuseDemo.render(&out.writer, arena, &ctx, try rt.object(arena, &.{}, &.{}), "reuse-demo");
    } else if (std.mem.eql(u8, args[1], "props")) {
        try PropsDemo.render(&out.writer, arena, &ctx, try rt.object(arena, &.{}, &.{}), "props-demo");
    } else if (std.mem.eql(u8, args[1], "cleanup")) {
        try TimerDemo.render(&out.writer, arena, &ctx, try rt.object(arena, &.{}, &.{}), "timer-demo");
    } else if (std.mem.eql(u8, args[1], "focus")) {
        try FocusDetails.render(&out.writer, arena, &ctx, .null, "focus-details");
    } else if (std.mem.eql(u8, args[1], "position")) {
        try AnchoredDetails.render(&out.writer, arena, &ctx, .null, "anchored-details");
    } else if (std.mem.eql(u8, args[1], "portals")) {
        try PersonDetails.render(&out.writer, arena, &ctx, .null, "person-details");
    } else if (std.mem.eql(u8, args[1], "refs")) {
        try FocusInput.render(&out.writer, arena, &ctx, try rt.object(arena, &.{}, &.{}), "focus-input");
    } else if (std.mem.eql(u8, args[1], "switch")) {
        try StatusMessage.render(&out.writer, arena, &ctx, try rt.object(arena, &.{}, &.{}), "status-message");
    } else if (std.mem.eql(u8, args[1], "inputs")) {
        try NameInput.render(&out.writer, arena, &ctx, try rt.object(arena, &.{}, &.{}), "name-input");
    } else if (std.mem.eql(u8, args[1], "lists")) {
        try ItemList.render(&out.writer, arena, &ctx, try rt.object(arena, &.{}, &.{}), "item-list");
    } else if (std.mem.eql(u8, args[1], "conditional")) {
        try ConditionalMessage.render(&out.writer, arena, &ctx, try rt.object(arena, &.{}, &.{}), "conditional-message");
    } else if (std.mem.eql(u8, args[1], "effects")) {
        try EffectCounter.render(&out.writer, arena, &ctx, try rt.object(arena, &.{}, &.{}), "effect-counter");
    } else if (std.mem.eql(u8, args[1], "derived")) {
        try DerivedCounter.render(&out.writer, arena, &ctx, try rt.object(arena, &.{}, &.{}), "derived-counter");
    } else if (std.mem.eql(u8, args[1], "state")) {
        try StateCounter.render(&out.writer, arena, &ctx, try rt.object(arena, &.{}, &.{}), "state-counter");
    } else if (std.mem.eql(u8, args[1], "greeting")) {
        try TemplateGreeting.render(&out.writer, arena, &ctx, try rt.object(arena, &.{}, &.{}), "template-greeting");
    } else if (std.mem.eql(u8, args[1], "counter")) {
        try SimpleCounter.render(&out.writer, arena, &ctx, try rt.object(arena, &.{}, &.{}), "simple-counter");
    } else if (std.mem.eql(u8, args[1], "navigation") and args.len == 3) {
        try NavigationPage.render(&out.writer, arena, &ctx, try rt.object(arena, &.{"page"}, &.{.{ .string = args[2] }}), "navigation-page");
    } else if (ctx.initial) {
        const search = if (args.len > 2) args[2] else "";
        try Desk.render(&out.writer, arena, &ctx, try rt.object(arena, &.{"search"}, &.{.{ .string = search }}), "team-desk");
    } else if (std.mem.eql(u8, args[1], "types")) {
        if (!(try Desk.writeTypes(&out.writer, "../../backend/team.zig"))) return error.NoTypes;
    } else if (std.mem.eql(u8, args[1], "call") and (args.len == 4 or args.len == 5)) {
        if (args.len == 5) {
            const additions = try std.json.parseFromSlice([]const Backend.QueryPerson, arena, args[4], .{});
            ctx.query_additions = additions.value;
        }
        const arguments = try std.json.parseFromSlice(rt.Value, arena, args[3], .{});
        if (!(try Desk.dispatch(&out.writer, arena, &ctx, args[2], arguments.value)) and
            !(try AsyncExample.dispatch(&out.writer, arena, &ctx, args[2], arguments.value)) and
            !(try PeopleReader.dispatch(&out.writer, arena, &ctx, args[2], arguments.value)) and
            !(try PeopleSearch.dispatch(&out.writer, arena, &ctx, args[2], arguments.value))) return error.UnknownOperation;
    } else return error.InvalidCommand;
    var buffer: [8192]u8 = undefined;
    var stdout = std.Io.File.Writer.init(.stdout(), init.io, &buffer);
    try stdout.interface.writeAll(out.written());
    try stdout.interface.flush();
}
