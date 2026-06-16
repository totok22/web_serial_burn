export const CONFIG_SECTION = "serialFlash";

export const RESET_MODES = [
  { id: "dtr-low-rts-high", label: "CH340C 经典电路", description: "DTR low / RTS high verified classic CH340C timing" },
  { id: "ch340x", label: "CH340X 直连电路", description: "Direct DTR/RTS wiring timing" },
  { id: "none", label: "手动 BOOT0/RESET", description: "Do not drive modem control lines" },
  { id: "dtr-high-rts-low", label: "通用 DTR 高复位 / RTS 低 BOOT", description: "Generic preset" },
  { id: "custom", label: "自定义 DTR/RTS 映射", description: "Use serialFlash.customReset.* settings" },
];

export const GLOBAL_KEYS = {
  port: "serialFlash.lastSuccessfulPort",
  firmware: "serialFlash.lastSuccessfulFirmware",
  resetMode: "serialFlash.lastResetMode",
  baudRate: "serialFlash.lastBaudRate",
};

function numberSetting(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function boolSetting(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function configuredValue(config, key) {
  const inspected = config.inspect(key);
  return inspected?.workspaceFolderValue
    ?? inspected?.workspaceValue
    ?? inspected?.globalValue
    ?? undefined;
}

export function readFlashSettings(vscode, context) {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const firmware = config.get("firmware") || context.globalState.get(GLOBAL_KEYS.firmware) || "";
  const port = config.get("port") || context.globalState.get(GLOBAL_KEYS.port) || "";
  const resetMode = config.get("resetMode") || context.globalState.get(GLOBAL_KEYS.resetMode) || "dtr-low-rts-high";
  const baudRate = config.get("baudRate") || context.globalState.get(GLOBAL_KEYS.baudRate) || 115200;

  return {
    firmware,
    port,
    baudRate: numberSetting(baudRate, 115200),
    parity: config.get("parity") || "even",
    resetMode,
    customReset: {
      boot0High: config.get("customReset.boot0High") || "dtr-false",
      boot0Low: config.get("customReset.boot0Low") || "",
      resetAssert: config.get("customReset.resetAssert") || "rts-true",
    },
    flashAddress: configuredValue(config, "flashAddress") || "",
    packetSize: numberSetting(config.get("packetSize"), 256),
    timeout: numberSetting(config.get("timeout"), 2000),
    eraseBeforeWrite: boolSetting(config.get("eraseBeforeWrite"), true),
    verifyAfterWrite: boolSetting(config.get("verifyAfterWrite"), true),
    runAfterWrite: boolSetting(config.get("runAfterWrite"), true),
    closePortAfterWrite: boolSetting(config.get("closePortAfterWrite"), true),
    unlockReadProtection: boolSetting(config.get("unlockReadProtection"), false),
    autoDiscoverFirmware: boolSetting(config.get("autoDiscoverFirmware"), true),
    firmwareGlobs: config.get("firmwareGlobs") || ["**/*.hex", "**/*.bin"],
    excludeGlobs: config.get("excludeGlobs") || ["**/{node_modules,.git,dist}/**"],
    projects: config.get("projects") || [],
  };
}

export async function updateWorkspaceSetting(vscode, key, value) {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  await config.update(key, value, vscode.ConfigurationTarget.Workspace);
}

export async function rememberSuccessfulFlash(vscode, context, settings) {
  await Promise.all([
    context.globalState.update(GLOBAL_KEYS.port, settings.port || undefined),
    context.globalState.update(GLOBAL_KEYS.firmware, settings.firmware || undefined),
    context.globalState.update(GLOBAL_KEYS.resetMode, settings.resetMode || undefined),
    context.globalState.update(GLOBAL_KEYS.baudRate, settings.baudRate || undefined),
    settings.firmware ? updateWorkspaceSetting(vscode, "firmware", settings.firmware) : Promise.resolve(),
    settings.resetMode ? updateWorkspaceSetting(vscode, "resetMode", settings.resetMode) : Promise.resolve(),
  ]);
}

export function parseAddress(value) {
  const text = String(value ?? "").trim();
  const parsed = text.toLowerCase().startsWith("0x")
    ? Number.parseInt(text, 16)
    : Number.parseInt(text, 10);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid flash address: ${value}`);
  return parsed >>> 0;
}

export function flashSettingsKeys() {
  return [
    "firmware",
    "port",
    "baudRate",
    "parity",
    "resetMode",
    "customReset.boot0High",
    "customReset.boot0Low",
    "customReset.resetAssert",
    "flashAddress",
    "packetSize",
    "timeout",
    "eraseBeforeWrite",
    "verifyAfterWrite",
    "runAfterWrite",
    "closePortAfterWrite",
    "unlockReadProtection",
  ];
}

export function resolveResetConfig(settings) {
  if (settings.resetMode !== "custom") return settings.resetMode;
  return {
    boot0High: settings.customReset?.boot0High || "dtr-false",
    boot0Low: settings.customReset?.boot0Low || undefined,
    resetAssert: settings.customReset?.resetAssert || "rts-true",
  };
}

export async function applyFlashSettings(vscode, settings) {
  await Promise.all(flashSettingsKeys().map((key) => {
    if (key.startsWith("customReset.")) {
      const field = key.slice("customReset.".length);
      if (!settings.customReset || !(field in settings.customReset)) return Promise.resolve();
      return updateWorkspaceSetting(vscode, key, settings.customReset[field]);
    }
    if (!(key in settings)) return Promise.resolve();
    return updateWorkspaceSetting(vscode, key, settings[key]);
  }));
}
