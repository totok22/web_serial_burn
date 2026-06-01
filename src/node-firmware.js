import { parseIntelHex } from "./firmware.js";

export async function loadFirmwarePath(path, readFile) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".hex")) {
    const text = await readFile(path, "utf8");
    return { ...parseIntelHex(text), format: "hex" };
  }
  return { bytes: new Uint8Array(await readFile(path)), baseAddress: null, format: "bin" };
}
