import test from "node:test";
import assert from "node:assert/strict";
import { clearFlashHistory, readFlashHistory, recordFlashHistory } from "../src/vscode/history.js";

function fakeContext() {
  const store = new Map();
  return {
    globalState: {
      get(key, fallback) {
        return store.has(key) ? store.get(key) : fallback;
      },
      async update(key, value) {
        if (value === undefined) store.delete(key);
        else store.set(key, value);
      },
    },
  };
}

test("recordFlashHistory dedupes same firmware port and reset mode", async () => {
  const context = fakeContext();

  await recordFlashHistory(context, { firmware: "a.hex", port: "COM3", resetMode: "ch340x" });
  await recordFlashHistory(context, { firmware: "a.hex", port: "COM3", resetMode: "ch340x", bytes: 10 });

  const history = readFlashHistory(context);
  assert.equal(history.length, 1);
  assert.equal(history[0].bytes, 10);
});

test("clearFlashHistory removes stored entries", async () => {
  const context = fakeContext();

  await recordFlashHistory(context, { firmware: "a.hex", port: "COM3", resetMode: "ch340x" });
  await clearFlashHistory(context);

  assert.deepEqual(readFlashHistory(context), []);
});
