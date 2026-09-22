import assert from "node:assert/strict";
import { createQueryData } from "../server/query-data.mjs";
const data = createQueryData();
data.create("server");
data.create("browser");
assert.deepEqual(data.snapshot("server"), []);
assert.deepEqual(data.add("server"), { id: 4, name: "Noah Williams" });
assert.deepEqual(data.snapshot("browser"), []);
assert.deepEqual(data.add("server"), { id: 5, name: "Priya Shah" });
assert.deepEqual(
  data.snapshot("server").map((person) => person.id),
  [5, 4],
);
const snapshot = data.snapshot("server");
data.add("server");
assert.equal(snapshot.length, 2, "An in-flight query keeps its captured snapshot");
data.dispose("server");
assert.equal(data.add("server"), null, "Disposed previews cannot accept late writes");
data.create("server");
assert.deepEqual(data.snapshot("server"), [], "Replay starts with no additions");
data.dispose("server");
data.dispose("browser");
console.log(
  "Query data passed: writes, stable IDs, independent snapshots, isolation, disposal and replay.",
);
