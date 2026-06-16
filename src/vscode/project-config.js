import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

function stripJsoncComments(text) {
  let out = "";
  let inString = false;
  let quote = "";
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inString) {
      out += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        inString = false;
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      inString = true;
      quote = char;
      out += char;
      continue;
    }

    if (char === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i += 1;
      out += "\n";
      continue;
    }

    if (char === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i += 1;
      i += 1;
      continue;
    }

    out += char;
  }

  return out;
}

function stripTrailingCommas(text) {
  let out = "";
  let inString = false;
  let quote = "";
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      out += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        inString = false;
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      inString = true;
      quote = char;
      out += char;
      continue;
    }

    if (char === ",") {
      let index = i + 1;
      while (/\s/.test(text[index] || "")) index += 1;
      if (text[index] === "}" || text[index] === "]") continue;
    }

    out += char;
  }
  return out;
}

export function parseJsonc(text) {
  return JSON.parse(stripTrailingCommas(stripJsoncComments(text)));
}

export function serialFlashSettingsFromState(settings) {
  const out = {
    "serialFlash.firmware": settings.firmware || "",
    "serialFlash.port": settings.port || "",
    "serialFlash.baudRate": settings.baudRate || 115200,
    "serialFlash.parity": settings.parity || "even",
    "serialFlash.resetMode": settings.resetMode || "dtr-low-rts-high",
    "serialFlash.customReset.boot0High": settings.customReset?.boot0High || "dtr-false",
    "serialFlash.customReset.boot0Low": settings.customReset?.boot0Low || "",
    "serialFlash.customReset.resetAssert": settings.customReset?.resetAssert || "rts-true",
    "serialFlash.packetSize": settings.packetSize || 256,
    "serialFlash.timeout": settings.timeout || 2000,
    "serialFlash.eraseBeforeWrite": settings.eraseBeforeWrite !== false,
    "serialFlash.verifyAfterWrite": settings.verifyAfterWrite !== false,
    "serialFlash.runAfterWrite": settings.runAfterWrite !== false,
    "serialFlash.closePortAfterWrite": settings.closePortAfterWrite !== false,
    "serialFlash.unlockReadProtection": settings.unlockReadProtection === true,
    "serialFlash.autoDiscoverFirmware": settings.autoDiscoverFirmware !== false,
    "serialFlash.firmwareGlobs": settings.firmwareGlobs?.length ? settings.firmwareGlobs : ["**/*.hex", "**/*.bin"],
    "serialFlash.excludeGlobs": settings.excludeGlobs?.length ? settings.excludeGlobs : ["**/{node_modules,.git,dist}/**"],
  };
  if (settings.flashAddress) out["serialFlash.flashAddress"] = settings.flashAddress;
  return out;
}

export function projectProfileFromState(name, settings) {
  return {
    name,
    firmware: settings.firmware || "",
    port: settings.port || "",
    baudRate: settings.baudRate || 115200,
    parity: settings.parity || "even",
    resetMode: settings.resetMode || "dtr-low-rts-high",
    customReset: {
      boot0High: settings.customReset?.boot0High || "dtr-false",
      boot0Low: settings.customReset?.boot0Low || "",
      resetAssert: settings.customReset?.resetAssert || "rts-true",
    },
    flashAddress: settings.flashAddress || "",
    packetSize: settings.packetSize || 256,
    timeout: settings.timeout || 2000,
    eraseBeforeWrite: settings.eraseBeforeWrite !== false,
    verifyAfterWrite: settings.verifyAfterWrite !== false,
    runAfterWrite: settings.runAfterWrite !== false,
    closePortAfterWrite: settings.closePortAfterWrite !== false,
    unlockReadProtection: settings.unlockReadProtection === true,
  };
}

export async function writeProjectSettings(vscode, settings) {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) throw new Error("Open a workspace before creating project config.");

  const path = join(root, ".vscode", "settings.json");
  await mkdir(dirname(path), { recursive: true });

  let current = {};
  try {
    current = parseJsonc(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const next = {
    ...current,
    ...serialFlashSettingsFromState(settings),
  };
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`);
  return path;
}
