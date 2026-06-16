import test from "node:test";
import assert from "node:assert/strict";
import { SerialFlashPanel } from "../src/vscode/panel.js";

function fakeVscode() {
  return {
    ViewColumn: { One: 1 },
    Uri: {
      joinPath(uri, ...parts) {
        return { fsPath: [uri.fsPath, ...parts].join("/") };
      },
    },
    window: {
      createWebviewPanel() {
        throw new Error("not used");
      },
    },
  };
}

function makePanel(controller) {
  const messages = [];
  const panel = new SerialFlashPanel(
    fakeVscode(),
    { extensionUri: { fsPath: "/extension" } },
    { show: () => controller.calls.push(["output"]) },
  );
  panel.controller = controller;
  panel.panel = {
    webview: {
      postMessage(message) {
        messages.push(message);
      },
    },
  };
  return { panel, messages };
}

function makeHtmlPanel() {
  const panel = new SerialFlashPanel(
    fakeVscode(),
    { extensionUri: { fsPath: "/extension" } },
    { show: () => {} },
  );
  panel.panel = {
    webview: {
      cspSource: "vscode-resource:",
      asWebviewUri(uri) {
        return uri.fsPath;
      },
    },
  };
  return panel;
}

function fakeController() {
  const calls = [];
  return {
    calls,
    panelState: () => ({ settings: { firmware: "app.hex" } }),
    flashLatestFirmware: async () => calls.push(["flash"]),
    selectFirmware: async () => calls.push(["selectFirmware"]),
    selectSerialPort: async (force) => calls.push(["selectPort", force]),
    selectResetMode: async () => calls.push(["selectReset"]),
    resetToBootloader: async () => calls.push(["bootloader"]),
    resetAndRun: async () => calls.push(["run"]),
    runDiagnostics: async () => calls.push(["diagnostics"]),
    cancelFlash: () => calls.push(["cancel"]),
    eraseChip: async () => calls.push(["erase"]),
    verifyLatestFirmware: async () => calls.push(["verify"]),
    unlockReadProtection: async () => calls.push(["unlock"]),
    closeActivePort: async () => calls.push(["closePort"]),
    createProjectConfig: async () => calls.push(["projectConfig"]),
    createTasks: async () => calls.push(["createTasks"]),
    createProjectProfile: async () => calls.push(["createProfile"]),
    selectProjectProfile: async () => calls.push(["selectProfile"]),
    clearHistory: async () => calls.push(["clearHistory"]),
    clearRememberedDevice: async () => calls.push(["clearRemembered"]),
    updateSetting: async (key, value) => calls.push(["saveSetting", key, value]),
  };
}

test("panel ready message posts current state", async () => {
  const controller = fakeController();
  const { panel, messages } = makePanel(controller);

  await panel.handleMessage({ type: "ready" });

  assert.deepEqual(messages, [
    { type: "state", state: { settings: { firmware: "app.hex" } } },
  ]);
});

test("panel action messages dispatch to controller", async () => {
  const controller = fakeController();
  const { panel } = makePanel(controller);

  await panel.handleMessage({ type: "action", action: "flash" });
  await panel.handleMessage({ type: "action", action: "cancel" });
  await panel.handleMessage({ type: "action", action: "selectPort" });
  await panel.handleMessage({ type: "action", action: "diagnostics" });
  await panel.handleMessage({ type: "action", action: "saveSetting", key: "baudRate", value: 57600 });
  await panel.handleMessage({ type: "action", action: "createProfile" });

  assert.deepEqual(controller.calls, [
    ["flash"],
    ["cancel"],
    ["selectPort", true],
    ["diagnostics"],
    ["saveSetting", "baudRate", 57600],
    ["createProfile"],
  ]);
});

test("panel marks running-safe actions and cancel button", () => {
  const html = makeHtmlPanel().html();

  assert.match(html, /data-action="cancel" data-allow-running="true" data-requires-running="true"/);
  assert.match(html, /data-action="output" data-allow-running="true"/);
  assert.match(html, /data-action="diagnostics" data-allow-running="true"/);
  assert.match(html, /class="primary" data-action="flash"/);
});

test("panel includes troubleshooting output area", () => {
  const html = makeHtmlPanel().html();

  assert.match(html, /<h2>Troubleshooting<\/h2>/);
  assert.match(html, /<ul id="troubleshooting"><\/ul>/);
});
