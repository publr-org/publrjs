import assert from "node:assert/strict";
import { state, createStore, createStoreContainer } from "../dist/publr.js";

assert.equal(typeof document, "undefined");
assert.throws(() => createStore("request", () => ({ state: {} })), /explicit store container/);
const count = state(1);
count.value++;
assert.equal(count.value, 2);

const first = createStoreContainer();
const second = createStoreContainer();
const events = [[], []];
const watches = [[], []];
const a = first.createStore("session", () => ({
  state: { user: "Alice", nested: { n: 0 } },
  watch: { "*": (value) => watches[0].push(value) },
}));
first.subscribe("session", (change) => events[0].push(change.newValue));
await Promise.resolve();
const b = second.createStore("session", () => ({
  state: { user: "Bob", nested: { n: 0 } },
  watch: { "*": (value) => watches[1].push(value) },
}));
second.subscribe("session", (change) => events[1].push(change.newValue));
await Promise.resolve();
await Promise.all([
  (async () => {
    await Promise.resolve();
    a.nested.n = 1;
    assert.equal(first.stores.session.user, "Alice");
  })(),
  (async () => {
    b.nested.n = 2;
    await Promise.resolve();
    assert.equal(second.stores.session.user, "Bob");
  })(),
]);
assert.deepEqual(events, [[1], [2]]);
assert.deepEqual(watches, [[1], [2]]);
assert(!JSON.stringify(first.stores).includes("Bob"));
first.dispose();
b.nested.n = 3;
a.nested.n = 4;
assert.deepEqual(events, [[1], [2, 3]]);
second.dispose();
const cancelled = createStoreContainer();
let calls = 0;
const old = cancelled.createStore("session", () => ({
  state: { user: "Old" },
  watch: { "*": () => calls++ },
}));
cancelled.dispose();
await Promise.resolve();
old.user = "Retired";
assert.equal(calls, 0);
const fresh = createStoreContainer();
assert.equal(fresh.createStore("session", () => ({ state: { user: "Fresh" } })).user, "Fresh");
fresh.dispose();
console.log(
  "Node request isolation: overlapping awaits, same names, nested subscriptions, deferred watchers, transfer serialization and cancellation passed.",
);
