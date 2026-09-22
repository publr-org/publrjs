import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createRequestGates } from "../server/request-gates.mjs";
const gates = createRequestGates();
gates.create("one", true);
gates.create("two", true);
let oneDone = false,
  twoDone = false;
const one = gates.wait("one", new EventEmitter()).then(() => {
  oneDone = true;
});
const twoResponse = new EventEmitter();
const two = gates.wait("two", twoResponse).then(() => {
  twoDone = true;
});
await new Promise((resolve) => setTimeout(resolve, 20));
assert.equal(oneDone, false);
assert.equal(twoDone, false);
gates.control("one", "release");
await one;
assert.equal(twoDone, false);
twoResponse.emit("close");
await two;
assert.equal(twoResponse.listenerCount("close"), 0);
gates.control("one", "release");
await gates.wait("one", new EventEmitter()); // Release arriving before its request.
const cancelled = gates.wait("two", new EventEmitter());
gates.control("two", "dispose");
await cancelled;
gates.control("one", "fail");
gates.control("one", "slow");
const firstLetter = gates.begin("one");
const finalSearch = gates.begin("one");
assert.equal(firstLetter.slow, true);
assert.equal(finalSearch.slow, false);
assert.equal(firstLetter.takeFailure(), false); // Superseded reads cannot consume failure.
assert.equal(finalSearch.takeFailure(), true);
assert.equal(finalSearch.takeFailure(), false);
assert.equal(gates.begin("one").takeFailure(), false); // Retry succeeds.
gates.control("one", "fail");
const slowOlder = gates.begin("one");
const fastNewer = gates.begin("one");
assert.equal(fastNewer.takeFailure(), true);
assert.equal(slowOlder.takeFailure(), false); // Late older response cannot consume a new arm.
gates.control("one", "fail");
assert.equal(slowOlder.takeFailure(), false);
gates.control("one", "cancel-fail");
assert.equal(gates.begin("one").takeFailure(), false);
const inFlight = gates.begin("one");
gates.control("one", "fail");
assert.equal(inFlight.takeFailure(), true); // Can also fail a paused response.
gates.create("other", false);
gates.control("one", "fail");
assert.equal(gates.begin("other").takeFailure(), false);
const disposedRequest = gates.begin("one");
gates.control("one", "dispose");
assert.equal(disposedRequest.takeFailure(), false);
gates.control("other", "dispose");
gates.control("one", "dispose");
console.log(
  "Request gates passed: pause, independent release, early release, disconnect and disposal.",
);
