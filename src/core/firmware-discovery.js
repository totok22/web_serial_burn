const FIRMWARE_EXTENSIONS = new Set([".hex", ".bin"]);
const PREFERRED_PATH_PARTS = ["build", "debug", "release"];
const PREFERRED_PREFIXES = ["cmake-build-"];

function extensionOf(path) {
  const index = path.lastIndexOf(".");
  return index === -1 ? "" : path.slice(index).toLowerCase();
}

function normalizePath(path) {
  return path.replace(/\\/g, "/");
}

function pathParts(path) {
  return normalizePath(path).toLowerCase().split("/");
}

function basenameWithoutExtension(path) {
  const normalized = normalizePath(path);
  const name = normalized.slice(normalized.lastIndexOf("/") + 1);
  const index = name.lastIndexOf(".");
  return index === -1 ? name : name.slice(0, index);
}

export function isFirmwarePath(path) {
  return FIRMWARE_EXTENSIONS.has(extensionOf(path));
}

export function scoreFirmwareCandidate(candidate, {
  newestMtimeMs = candidate.mtimeMs,
  workspaceName = "",
  rememberedPath = "",
} = {}) {
  const relativePath = normalizePath(candidate.relativePath ?? candidate.path ?? "");
  const ext = extensionOf(relativePath);
  let score = 0;

  if (Number.isFinite(candidate.mtimeMs) && Number.isFinite(newestMtimeMs)) {
    const ageMinutes = Math.max(0, (newestMtimeMs - candidate.mtimeMs) / 60000);
    score += Math.max(0, 80 - Math.min(80, ageMinutes));
  }

  if (ext === ".hex") score += 30;
  if (ext === ".bin") score += 12;

  const parts = pathParts(relativePath);
  for (const part of parts) {
    if (PREFERRED_PATH_PARTS.includes(part)) score += 16;
    if (PREFERRED_PREFIXES.some((prefix) => part.startsWith(prefix))) score += 18;
  }

  const lowerWorkspace = workspaceName.toLowerCase();
  if (lowerWorkspace && basenameWithoutExtension(relativePath).toLowerCase().includes(lowerWorkspace)) {
    score += 12;
  }

  if (rememberedPath && normalizePath(rememberedPath) === relativePath) score += 40;

  if (ext === ".bin" && Number.isFinite(candidate.size) && candidate.size < 1024) score -= 35;

  return score;
}

export function sortFirmwareCandidates(candidates, options = {}) {
  const newestMtimeMs = Math.max(0, ...candidates.map((candidate) => candidate.mtimeMs ?? 0));
  return candidates
    .filter((candidate) => isFirmwarePath(candidate.relativePath ?? candidate.path ?? ""))
    .map((candidate) => ({
      ...candidate,
      score: scoreFirmwareCandidate(candidate, { ...options, newestMtimeMs }),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if ((b.mtimeMs ?? 0) !== (a.mtimeMs ?? 0)) return (b.mtimeMs ?? 0) - (a.mtimeMs ?? 0);
      return (a.relativePath ?? a.path).localeCompare(b.relativePath ?? b.path);
    });
}

export function shouldAutoSelectFirmware(sortedCandidates) {
  if (sortedCandidates.length <= 1) return sortedCandidates.length === 1;
  return sortedCandidates[0].score - sortedCandidates[1].score >= 35;
}

export function formatFirmwareSize(bytes) {
  if (!Number.isFinite(bytes)) return "unknown size";
  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(kib >= 10 ? 0 : 1)} KB`;
  const mib = kib / 1024;
  return `${mib.toFixed(mib >= 10 ? 1 : 2)} MB`;
}
