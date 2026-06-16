import test from "node:test";
import assert from "node:assert/strict";
import { SerialFlashController } from "../src/vscode/commands.js";

function fakeVscode(port = "") {
  const statusBarItems = [];
  return {
    StatusBarAlignment: { Left: 1 },
    statusBarItems,
    window: {
      createStatusBarItem() {
        const item = {
          show() {},
          dispose() {},
        };
        statusBarItems.push(item);
        return item;
      },
    },
    commands: {
      registerCommand() {
        return { dispose() {} };
      },
    },
    workspace: {
      getConfiguration() {
        return {
          get(key) {
            if (key === "port") return port;
            return undefined;
          },
          inspect() {
            return {};
          },
          update: async () => {},
        };
      },
    },
    ConfigurationTarget: { Workspace: 1 },
  };
}

function fakeContext() {
  return {
    subscriptions: [],
    globalState: {
      get(_key, fallback) {
        return fallback;
      },
      update: async () => {},
    },
  };
}

test("syncStatusBarFromSettings updates idle status bar from profile port", () => {
  const vscode = fakeVscode();
  const controller = new SerialFlashController(vscode, fakeContext(), {}, null);

  controller.syncStatusBarFromSettings({ port: "COM3" });

  assert.equal(vscode.statusBarItems[0].text, "SerialFlash: COM3");
  assert.equal(vscode.statusBarItems[0].command, "serialFlash.openPanel");
});

test("syncStatusBarFromSettings does not overwrite flashing progress", () => {
  const vscode = fakeVscode();
  const controller = new SerialFlashController(vscode, fakeContext(), {}, null);
  controller.isFlashing = true;
  vscode.statusBarItems[0].text = "SerialFlash: write 50%";

  controller.syncStatusBarFromSettings({ port: "COM3" });

  assert.equal(vscode.statusBarItems[0].text, "SerialFlash: write 50%");
});
