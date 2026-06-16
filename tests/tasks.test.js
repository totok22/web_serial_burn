import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mergeSerialFlashTasks, serialFlashTaskDefinitions, writeProjectTasks } from "../src/vscode/tasks.js";

test("serialFlashTaskDefinitions includes core task actions", () => {
  assert.deepEqual(serialFlashTaskDefinitions().map((task) => task.action), [
    "flashLatest",
    "bootloader",
    "run",
  ]);
});

test("mergeSerialFlashTasks preserves unrelated tasks and replaces SerialFlash tasks", () => {
  const merged = mergeSerialFlashTasks({
    version: "2.0.0",
    tasks: [
      { label: "build", type: "shell", command: "make" },
      { label: "SerialFlash: Flash Latest Firmware", type: "serialFlash", action: "old" },
    ],
  });

  assert.equal(merged.tasks.some((task) => task.label === "build"), true);
  assert.equal(merged.tasks.filter((task) => task.label === "SerialFlash: Flash Latest Firmware").length, 1);
  assert.equal(
    merged.tasks.find((task) => task.label === "SerialFlash: Flash Latest Firmware").action,
    "flashLatest",
  );
});

test("writeProjectTasks merges JSONC tasks and preserves unrelated tasks", async () => {
  const root = await mkdtemp(join(tmpdir(), "serialflash-tasks-"));
  await mkdir(join(root, ".vscode"), { recursive: true });
  await writeFile(join(root, ".vscode", "tasks.json"), `{
    // existing task file
    "version": "2.0.0",
    "tasks": [
      {
        "label": "build",
        "type": "shell",
        "command": "make",
      },
    ],
  }\n`);

  await writeProjectTasks({
    workspace: {
      workspaceFolders: [{ uri: { fsPath: root } }],
    },
  });

  const written = JSON.parse(await readFile(join(root, ".vscode", "tasks.json"), "utf8"));
  assert.equal(written.tasks.some((task) => task.label === "build"), true);
  assert.equal(written.tasks.some((task) => task.label === "SerialFlash: Flash Latest Firmware"), true);
});
