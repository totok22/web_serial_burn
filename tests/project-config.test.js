import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  parseJsonc,
  projectProfileFromState,
  serialFlashSettingsFromState,
  writeProjectSettings,
} from "../src/vscode/project-config.js";

test("serialFlashSettingsFromState produces workspace settings keys", () => {
  const settings = serialFlashSettingsFromState({
    firmware: "build/app.hex",
    port: "COM3",
    baudRate: 57600,
    parity: "none",
    resetMode: "ch340x",
    customReset: {
      boot0High: "rts-true",
      resetAssert: "dtr-false",
    },
    flashAddress: "0x08004000",
    eraseBeforeWrite: false,
    verifyAfterWrite: true,
    runAfterWrite: false,
    closePortAfterWrite: true,
    unlockReadProtection: true,
    autoDiscoverFirmware: true,
    firmwareGlobs: ["PDM/**/*.hex"],
    excludeGlobs: ["**/.git/**"],
  });

  assert.equal(settings["serialFlash.firmware"], "build/app.hex");
  assert.equal(settings["serialFlash.baudRate"], 57600);
  assert.equal(settings["serialFlash.parity"], "none");
  assert.equal(settings["serialFlash.flashAddress"], "0x08004000");
  assert.equal(settings["serialFlash.customReset.boot0High"], "rts-true");
  assert.equal(settings["serialFlash.customReset.resetAssert"], "dtr-false");
  assert.equal(settings["serialFlash.eraseBeforeWrite"], false);
  assert.equal(settings["serialFlash.unlockReadProtection"], true);
  assert.deepEqual(settings["serialFlash.firmwareGlobs"], ["PDM/**/*.hex"]);
  assert.deepEqual(settings["serialFlash.excludeGlobs"], ["**/.git/**"]);
});

test("projectProfileFromState creates named multi-project profile", () => {
  const profile = projectProfileFromState("can", {
    firmware: "CAN/build/app.hex",
    port: "/dev/tty.usbserial-10",
    resetMode: "ch340x",
    customReset: {
      boot0High: "rts-true",
    },
    baudRate: 115200,
  });

  assert.equal(profile.name, "can");
  assert.equal(profile.firmware, "CAN/build/app.hex");
  assert.equal(profile.resetMode, "ch340x");
  assert.equal(profile.customReset.boot0High, "rts-true");
  assert.equal(profile.eraseBeforeWrite, true);
});

test("parseJsonc accepts comments and trailing commas", () => {
  assert.deepEqual(parseJsonc(`{
    // existing VS Code setting
    "editor.tabSize": 2,
    "files.associations": {
      "*.hex": "hex",
    },
  }`), {
    "editor.tabSize": 2,
    "files.associations": {
      "*.hex": "hex",
    },
  });
});

test("parseJsonc does not strip comma-looking text inside strings", () => {
  assert.deepEqual(parseJsonc(`{
    "serialFlash.note": "keep , } inside string",
    "serialFlash.list": ["keep , ] inside string",],
  }`), {
    "serialFlash.note": "keep , } inside string",
    "serialFlash.list": ["keep , ] inside string"],
  });
});

test("writeProjectSettings merges JSONC settings and preserves unrelated keys", async () => {
  const root = await mkdtemp(join(tmpdir(), "serialflash-settings-"));
  const vscodeDir = join(root, ".vscode");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(vscodeDir, { recursive: true }));
  await writeFile(join(vscodeDir, "settings.json"), `{
    // keep this
    "editor.tabSize": 2,
  }\n`);

  await writeProjectSettings({
    workspace: {
      workspaceFolders: [{ uri: { fsPath: root } }],
    },
  }, {
    firmware: "build/app.hex",
    port: "COM3",
    firmwareGlobs: ["build/**/*.hex"],
    excludeGlobs: ["**/.git/**"],
  });

  const written = JSON.parse(await readFile(join(vscodeDir, "settings.json"), "utf8"));
  assert.equal(written["editor.tabSize"], 2);
  assert.equal(written["serialFlash.firmware"], "build/app.hex");
  assert.deepEqual(written["serialFlash.firmwareGlobs"], ["build/**/*.hex"]);
  assert.deepEqual(written["serialFlash.excludeGlobs"], ["**/.git/**"]);
});
