import test from "node:test";
import assert from "node:assert/strict";
import { bootloaderEntryStages, enterBootloader, resetToRun } from "../src/serial-transport.js";

test("bootloaderEntryStages returns CH340X direct preset", () => {
  const stages = bootloaderEntryStages("ch340x");

  assert.deepEqual(stages, [
    {
      name: "CH340X 直连电路",
      config: "ch340x",
    },
  ]);
});

test("bootloaderEntryStages keeps normal modes single-stage", () => {
  assert.deepEqual(bootloaderEntryStages("dtr-low-rts-high"), [
    { name: "default", config: "dtr-low-rts-high" },
  ]);
});

test("enterBootloader applies CH340X direct timing", async () => {
  const calls = [];
  const transport = {
    async setSignals(signals) {
      calls.push(["signals", signals]);
    },
  };

  await enterBootloader(transport, async (ms) => calls.push(["delay", ms]), "ch340x");

  assert.deepEqual(calls, [
    ["signals", { requestToSend: false, dataTerminalReady: true }],
    ["delay", 150],
    ["signals", { requestToSend: true, dataTerminalReady: true }],
    ["delay", 150],
    ["signals", { requestToSend: true, dataTerminalReady: false }],
    ["delay", 150],
    ["signals", { requestToSend: true, dataTerminalReady: true }],
    ["delay", 1000],
  ]);
});

test("resetToRun applies CH340X run timing", async () => {
  const calls = [];
  const transport = {
    async setSignals(signals) {
      calls.push(["signals", signals]);
    },
  };

  await resetToRun(transport, async (ms) => calls.push(["delay", ms]), "ch340x");

  assert.deepEqual(calls, [
    ["signals", { requestToSend: false, dataTerminalReady: false }],
    ["delay", 250],
    ["signals", { requestToSend: false, dataTerminalReady: true }],
    ["delay", 250],
    ["signals", { requestToSend: false, dataTerminalReady: false }],
    ["delay", 1000],
  ]);
});
