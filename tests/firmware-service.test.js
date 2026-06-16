import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { discoverFirmware, makeFirmwareQuickPickItems } from "../src/vscode/firmware-service.js";

function fakeVscode(root, filesByGlob) {
  return {
    workspace: {
      workspaceFolders: [{ name: "app", uri: { fsPath: root } }],
      getWorkspaceFolder(uri) {
        return uri.fsPath.startsWith(`${root}/`) ? { uri: { fsPath: root } } : null;
      },
      async findFiles(glob, exclude) {
        return (filesByGlob[glob] || []).map((file) => ({ fsPath: file, exclude }));
      },
    },
  };
}

test("discoverFirmware uses configured globs and deduplicates results", async () => {
  const root = await mkdtemp(join(tmpdir(), "serialflash-fw-"));
  await mkdir(join(root, "build", "Debug"), { recursive: true });
  await writeFile(join(root, "build", "Debug", "app.hex"), ":00000001FF\n");
  await writeFile(join(root, "other.hex"), ":00000001FF\n");

  const candidates = await discoverFirmware(fakeVscode(root, {
    "**/Debug/*.hex": [join(root, "build", "Debug", "app.hex")],
    "**/*.hex": [join(root, "build", "Debug", "app.hex"), join(root, "other.hex")],
  }), {
    firmwareGlobs: ["**/Debug/*.hex", "**/*.hex"],
    excludeGlobs: ["**/.git/**"],
  });

  assert.deepEqual(candidates.map((candidate) => candidate.relativePath).sort(), [
    "build/Debug/app.hex",
    "other.hex",
  ]);
});

test("makeFirmwareQuickPickItems includes format, size, and HEX base address", async () => {
  const [item] = await makeFirmwareQuickPickItems([
    {
      path: "/workspace/build/app.hex",
      relativePath: "build/app.hex",
      size: 128,
      score: 120,
      mtimeMs: 1000,
    },
  ], async () => ({
    format: "hex",
    bytes: 64,
    baseAddress: 0x08004000,
  }));

  assert.equal(item.label, "build/app.hex");
  assert.equal(item.description, "128 B / score 120");
  assert.match(item.detail, /HEX \/ 64 B \/ base 0x08004000 \/ modified /);
});

test("makeFirmwareQuickPickItems keeps candidates when summary loading fails", async () => {
  const [item] = await makeFirmwareQuickPickItems([
    {
      path: "/workspace/bad.hex",
      relativePath: "bad.hex",
      size: 12,
      score: 1,
      mtimeMs: 1000,
    },
  ], async () => {
    throw new Error("bad hex");
  });

  assert.equal(item.label, "bad.hex");
  assert.match(item.detail, /Unable to read firmware details/);
});
