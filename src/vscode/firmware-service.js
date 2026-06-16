import { readFile, stat } from "node:fs/promises";
import { basename, relative } from "node:path";
import { loadFirmwarePath } from "../core/node-firmware.js";
import { formatFirmwareSize, shouldAutoSelectFirmware, sortFirmwareCandidates } from "../core/firmware-discovery.js";
import { toHex } from "../stm32.js";

const DEFAULT_FIRMWARE_GLOBS = ["**/*.hex", "**/*.bin"];
const DEFAULT_EXCLUDE_GLOBS = ["**/{node_modules,.git,dist}/**"];

function workspaceName(vscode) {
  const folder = vscode.workspace.workspaceFolders?.[0];
  return folder?.name ?? "";
}

function relativeToWorkspace(vscode, uri) {
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  if (!folder) return uri.fsPath;
  return relative(folder.uri.fsPath, uri.fsPath) || basename(uri.fsPath);
}

function excludePattern(excludeGlobs) {
  const globs = excludeGlobs?.length ? excludeGlobs : DEFAULT_EXCLUDE_GLOBS;
  if (globs.length === 1) return globs[0];
  return `{${globs.join(",")}}`;
}

export async function discoverFirmware(vscode, {
  rememberedPath = "",
  firmwareGlobs = DEFAULT_FIRMWARE_GLOBS,
  excludeGlobs = DEFAULT_EXCLUDE_GLOBS,
} = {}) {
  const includeGlobs = firmwareGlobs?.length ? firmwareGlobs : DEFAULT_FIRMWARE_GLOBS;
  const seen = new Set();
  const uris = [];
  for (const glob of includeGlobs) {
    const found = await vscode.workspace.findFiles(glob, excludePattern(excludeGlobs));
    for (const uri of found) {
      if (seen.has(uri.fsPath)) continue;
      seen.add(uri.fsPath);
      uris.push(uri);
    }
  }
  const candidates = await Promise.all(uris.map(async (uri) => {
    const info = await stat(uri.fsPath);
    return {
      path: uri.fsPath,
      uri,
      relativePath: relativeToWorkspace(vscode, uri),
      size: info.size,
      mtimeMs: info.mtimeMs,
    };
  }));

  return sortFirmwareCandidates(candidates, {
    workspaceName: workspaceName(vscode),
    rememberedPath,
  });
}

export async function loadFirmwareCandidate(candidate) {
  return loadFirmwarePath(candidate.path, readFile);
}

export async function loadFirmwareSummary(candidate) {
  const firmware = await loadFirmwareCandidate(candidate);
  return {
    format: firmware.format,
    bytes: firmware.bytes.length,
    baseAddress: firmware.baseAddress,
  };
}

function formatFirmwareSummary(summary) {
  if (!summary) return "Unable to read firmware details";
  const parts = [
    summary.format.toUpperCase(),
    formatFirmwareSize(summary.bytes),
  ];
  if (summary.baseAddress !== null && summary.baseAddress !== undefined) {
    parts.push(`base ${toHex(summary.baseAddress, 8)}`);
  }
  return parts.join(" / ");
}

export async function makeFirmwareQuickPickItems(candidates, loadSummary = loadFirmwareSummary) {
  return Promise.all(candidates.map(async (candidate) => {
    let summary = null;
    try {
      summary = await loadSummary(candidate);
    } catch (_) {
      summary = null;
    }
    return {
    label: candidate.relativePath,
    description: `${formatFirmwareSize(candidate.size)} / score ${Math.round(candidate.score)}`,
      detail: `${formatFirmwareSummary(summary)} / modified ${new Date(candidate.mtimeMs).toLocaleString()}`,
    candidate,
    };
  }));
}

export function canAutoSelectFirmware(candidates) {
  return shouldAutoSelectFirmware(candidates);
}

export { DEFAULT_EXCLUDE_GLOBS, DEFAULT_FIRMWARE_GLOBS };
