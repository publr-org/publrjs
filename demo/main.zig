// Keep the native module rooted at demo so it can import backend and generated components.
pub const main = @import("native/server.zig").main;
