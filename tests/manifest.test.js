import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readPackageJson() {
  return JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
}

async function readCommandsSource() {
  return readFile(new URL("../src/vscode/commands.js", import.meta.url), "utf8");
}

test("manifest command references are contributed", async () => {
  const manifest = await readPackageJson();
  const contributed = new Set(manifest.contributes.commands.map((command) => command.command));
  const referenced = [];

  for (const event of manifest.activationEvents) {
    if (event.startsWith("onCommand:")) referenced.push(event.slice("onCommand:".length));
  }
  for (const items of Object.values(manifest.contributes.menus)) {
    for (const item of items) {
      if (item.command) referenced.push(item.command);
    }
  }

  for (const command of referenced) {
    assert.equal(contributed.has(command), true, `${command} is referenced but not contributed`);
  }
});

test("controller registers every contributed SerialFlash command", async () => {
  const manifest = await readPackageJson();
  const source = await readCommandsSource();
  const registered = new Set(
    Array.from(source.matchAll(/registerCommand\("([^"]+)"/g), (match) => match[1]),
  );

  for (const { command } of manifest.contributes.commands) {
    assert.equal(registered.has(command), true, `${command} is contributed but not registered`);
  }
});

test("extension contributes final-version UI surfaces", async () => {
  const manifest = await readPackageJson();

  assert.ok(manifest.contributes.viewsContainers.activitybar.some((view) => view.id === "serialFlash"));
  assert.ok(manifest.contributes.views.serialFlash.some((view) => view.id === "serialFlash.sidebar"));
  assert.ok(manifest.contributes.taskDefinitions.some((definition) => definition.type === "serialFlash"));
});

test("firmware context menus include direct flash, verify, set, and info actions", async () => {
  const manifest = await readPackageJson();
  const expected = [
    "serialFlash.flashCurrentFile",
    "serialFlash.verifyFirmware",
    "serialFlash.setFirmware",
    "serialFlash.showFirmwareInfo",
  ];

  for (const menu of ["explorer/context", "editor/title/context"]) {
    assert.deepEqual(manifest.contributes.menus[menu].map((item) => item.command), expected);
  }
});
