import test from "node:test";
import assert from "node:assert/strict";
import { applyFlashSettings, flashSettingsKeys, readFlashSettings, resolveResetConfig, updateWorkspaceSetting } from "../src/vscode/settings.js";

function fakeVscode(values = {}, inspected = {}, { workspaceFolders } = {}) {
  const updates = [];
  return {
    updates,
    workspace: {
      workspaceFolders,
      getConfiguration() {
        return {
          get(key) {
            return values[key];
          },
          inspect(key) {
            return inspected[key] ?? {};
          },
          update: async (key, value, target) => {
            updates.push([key, value, target]);
          },
        };
      },
    },
    ConfigurationTarget: { Workspace: 1, Global: 2 },
  };
}

function fakeContext(globalValues = {}) {
  return {
    globalState: {
      get(key) {
        return globalValues[key];
      },
    },
  };
}

test("readFlashSettings leaves flashAddress empty unless explicitly configured", () => {
  const settings = readFlashSettings(fakeVscode({ flashAddress: "0x08000000" }), fakeContext());

  assert.equal(settings.flashAddress, "");
});

test("readFlashSettings returns explicitly configured flashAddress", () => {
  const settings = readFlashSettings(
    fakeVscode(
      { flashAddress: "0x08004000" },
      { flashAddress: { workspaceValue: "0x08004000" } },
    ),
    fakeContext(),
  );

  assert.equal(settings.flashAddress, "0x08004000");
});

test("flashSettingsKeys excludes project profile collection", () => {
  assert.equal(flashSettingsKeys().includes("projects"), false);
  assert.equal(flashSettingsKeys().includes("firmware"), true);
});

test("resolveResetConfig returns custom reset mapping", () => {
  assert.deepEqual(resolveResetConfig({
    resetMode: "custom",
    customReset: {
      boot0High: "rts-true",
      boot0Low: "rts-false",
      resetAssert: "dtr-true",
    },
  }), {
    boot0High: "rts-true",
    boot0Low: "rts-false",
    resetAssert: "dtr-true",
  });
});

test("applyFlashSettings writes nested custom reset settings", async () => {
  const vscode = fakeVscode();

  await applyFlashSettings(vscode, {
    resetMode: "custom",
    customReset: {
      boot0High: "rts-true",
      resetAssert: "dtr-false",
    },
  });

  assert.ok(vscode.updates.some(([key, value]) => key === "customReset.boot0High" && value === "rts-true"));
  assert.ok(vscode.updates.some(([key, value]) => key === "customReset.resetAssert" && value === "dtr-false"));
});

test("updateWorkspaceSetting writes to workspace when a folder is open", async () => {
  const vscode = fakeVscode({}, {}, { workspaceFolders: [{ uri: { fsPath: "/repo" } }] });

  await updateWorkspaceSetting(vscode, "port", "/dev/ttyUSB0");

  assert.deepEqual(vscode.updates, [["port", "/dev/ttyUSB0", 1]]);
});

test("updateWorkspaceSetting falls back to global without a workspace", async () => {
  const vscode = fakeVscode();

  await updateWorkspaceSetting(vscode, "port", "/dev/ttyUSB0");

  assert.deepEqual(vscode.updates, [["port", "/dev/ttyUSB0", 2]]);
});
