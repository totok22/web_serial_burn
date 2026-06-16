const HISTORY_KEY = "serialFlash.history";
const MAX_HISTORY = 20;

export function readFlashHistory(context) {
  return context.globalState.get(HISTORY_KEY, []);
}

export async function recordFlashHistory(context, entry) {
  const now = new Date().toISOString();
  const nextEntry = { ...entry, time: now };
  const existing = readFlashHistory(context);
  const deduped = existing.filter((item) =>
    item.firmware !== nextEntry.firmware ||
    item.port !== nextEntry.port ||
    item.resetMode !== nextEntry.resetMode
  );
  await context.globalState.update(HISTORY_KEY, [nextEntry, ...deduped].slice(0, MAX_HISTORY));
}

export async function clearFlashHistory(context) {
  await context.globalState.update(HISTORY_KEY, []);
}
