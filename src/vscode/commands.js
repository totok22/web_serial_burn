import { stat } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import { flashStm32Uart, syncBootloaderIgnoringNoise } from "../core/flash-session.js";
import { isFirmwarePath } from "../core/firmware-discovery.js";
import { enterBootloader, resetToRun } from "../core/reset-timing.js";
import { Stm32Bootloader } from "../stm32.js";
import { toHex } from "../stm32.js";
import { clearFlashHistory, readFlashHistory, recordFlashHistory } from "./history.js";
import { collectDiagnostics, formatDiagnostics } from "./diagnostics.js";
import { appendTroubleshooting, troubleshootingHints } from "./error-hints.js";
import { projectProfileFromState, writeProjectSettings } from "./project-config.js";
import {
  canAutoSelectFirmware,
  discoverFirmware,
  loadFirmwareCandidate,
  makeFirmwareQuickPickItems,
} from "./firmware-service.js";
import { createSerialTransport, listSerialPorts } from "./serial-service.js";
import { writeProjectTasks } from "./tasks.js";
import {
  RESET_MODES,
  GLOBAL_KEYS,
  applyFlashSettings,
  parseAddress,
  readFlashSettings,
  rememberSuccessfulFlash,
  resolveResetConfig,
  updateWorkspaceSetting,
} from "./settings.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function workspaceRoot(vscode) {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
}

function resolveWorkspacePath(vscode, path) {
  if (!path) return "";
  if (isAbsolute(path)) return path;
  const root = workspaceRoot(vscode);
  return root ? join(root, path) : path;
}

async function exists(path) {
  if (!path) return false;
  try {
    await stat(path);
    return true;
  } catch (_) {
    return false;
  }
}

function relativePath(vscode, filePath) {
  const root = workspaceRoot(vscode);
  return root ? relative(root, filePath) : filePath;
}

function sortPorts(ports) {
  return [...ports].sort((a, b) => {
    const score = (port) => {
      if (process.platform === "darwin" && port.path.startsWith("/dev/tty.usbserial-")) return 100;
      if (process.platform === "darwin" && port.path.startsWith("/dev/cu.usbserial-")) return 50;
      if (/ch340|usb/i.test(`${port.label} ${port.manufacturer}`)) return 20;
      return 0;
    };
    return score(b) - score(a) || a.path.localeCompare(b.path);
  });
}

function portDetail(port) {
  return [
    port.manufacturer,
    port.serialNumber && `SN ${port.serialNumber}`,
    port.vendorId && `VID ${port.vendorId}`,
    port.productId && `PID ${port.productId}`,
  ].filter(Boolean).join(" / ");
}

export function makeSerialPortQuickPickItems(ports, rememberedPort = "") {
  return ports.map((port) => ({
    label: port.path,
    description: port.path === rememberedPort ? "last used" : port.manufacturer,
    detail: portDetail(port),
    port,
  }));
}

export function statusBarTextForSettings(settings) {
  return settings.port ? `SerialFlash: ${settings.port}` : "SerialFlash";
}

function firmwareCandidateFromUri(vscode, uri) {
  return {
    path: uri.fsPath,
    uri,
    relativePath: relativePath(vscode, uri.fsPath),
    size: undefined,
    mtimeMs: Date.now(),
    score: 1000,
  };
}

export class SerialFlashController {
  constructor(vscode, context, output, panelFactory, sidebarProvider = null) {
    this.vscode = vscode;
    this.context = context;
    this.output = output;
    this.panelFactory = panelFactory;
    this.sidebarProvider = sidebarProvider;
    this.isFlashing = false;
    this.activeTransport = null;
    this.abortController = null;
    this.lastPanelState = {};
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBar.command = "serialFlash.openPanel";
    this.statusBar.text = statusBarTextForSettings(readFlashSettings(vscode, context));
    this.statusBar.tooltip = "Open SerialFlash panel";
    this.statusBar.show();
  }

  syncStatusBarFromSettings(settings = readFlashSettings(this.vscode, this.context)) {
    if (this.isFlashing) return;
    this.statusBar.command = "serialFlash.openPanel";
    this.statusBar.text = statusBarTextForSettings(settings);
  }

  register() {
    const commands = [
      this.vscode.commands.registerCommand("serialFlash.flashLatestFirmware", () => this.flashLatestFirmware()),
      this.vscode.commands.registerCommand("serialFlash.flashCurrentFile", (uri) => this.flashCurrentFile(uri)),
      this.vscode.commands.registerCommand("serialFlash.selectFirmware", (uri) => this.selectFirmware(uri)),
      this.vscode.commands.registerCommand("serialFlash.setFirmware", (uri) => this.selectFirmware(uri)),
      this.vscode.commands.registerCommand("serialFlash.showFirmwareInfo", (uri) => this.showFirmwareInfo(uri)),
      this.vscode.commands.registerCommand("serialFlash.selectSerialPort", () => this.selectSerialPort(true)),
      this.vscode.commands.registerCommand("serialFlash.selectResetMode", () => this.selectResetMode()),
      this.vscode.commands.registerCommand("serialFlash.openPanel", () => this.openPanel()),
      this.vscode.commands.registerCommand("serialFlash.resetToBootloader", () => this.resetToBootloader()),
      this.vscode.commands.registerCommand("serialFlash.resetAndRun", () => this.resetAndRun()),
      this.vscode.commands.registerCommand("serialFlash.showOutput", () => this.output.show()),
      this.vscode.commands.registerCommand("serialFlash.runDiagnostics", () => this.runDiagnostics()),
      this.vscode.commands.registerCommand("serialFlash.eraseChip", () => this.eraseChip()),
      this.vscode.commands.registerCommand("serialFlash.verifyFirmware", (uri) => this.verifyLatestFirmware(uri)),
      this.vscode.commands.registerCommand("serialFlash.unlockReadProtection", () => this.unlockReadProtection()),
      this.vscode.commands.registerCommand("serialFlash.clearRememberedDevice", () => this.clearRememberedDevice()),
      this.vscode.commands.registerCommand("serialFlash.closePort", () => this.closeActivePort()),
      this.vscode.commands.registerCommand("serialFlash.cancel", () => this.cancelFlash()),
      this.vscode.commands.registerCommand("serialFlash.createProjectConfig", () => this.createProjectConfig()),
      this.vscode.commands.registerCommand("serialFlash.createTasks", () => this.createTasks()),
      this.vscode.commands.registerCommand("serialFlash.createProjectProfile", () => this.createProjectProfile()),
      this.vscode.commands.registerCommand("serialFlash.selectProjectProfile", () => this.selectProjectProfile()),
      this.vscode.commands.registerCommand("serialFlash.clearHistory", () => this.clearHistory()),
      this.vscode.commands.registerCommand("serialFlash.refreshSidebar", () => this.refreshViews()),
    ];
    this.context.subscriptions.push(...commands, this.statusBar);
  }

  async flashLatestFirmware() {
    const candidate = await this.resolveFirmwareForFlash();
    if (!candidate) return;
    await this.flashCandidate(candidate);
  }

  async flashCurrentFile(uri) {
    const target = uri ?? this.vscode.window.activeTextEditor?.document?.uri;
    if (!target?.fsPath || !isFirmwarePath(target.fsPath)) {
      this.vscode.window.showWarningMessage("当前文件不是 .hex 或 .bin 固件。");
      return;
    }
    const candidate = firmwareCandidateFromUri(this.vscode, target);
    await updateWorkspaceSetting(this.vscode, "firmware", candidate.relativePath);
    await this.flashCandidate(candidate);
  }

  async selectFirmware(uri) {
    if (uri?.fsPath && isFirmwarePath(uri.fsPath)) {
      const candidate = firmwareCandidateFromUri(this.vscode, uri);
      await updateWorkspaceSetting(this.vscode, "firmware", candidate.relativePath);
      this.vscode.window.showInformationMessage(`SerialFlash firmware: ${candidate.relativePath}`);
      this.refreshViews();
      return candidate;
    }

    const settings = readFlashSettings(this.vscode, this.context);
    const candidates = await discoverFirmware(this.vscode, {
      rememberedPath: settings.firmware,
      firmwareGlobs: settings.firmwareGlobs,
      excludeGlobs: settings.excludeGlobs,
    });
    if (candidates.length === 0) {
      this.vscode.window.showWarningMessage("工作区中没有找到 .hex 或 .bin 固件。");
      return null;
    }
    const picked = await this.vscode.window.showQuickPick(await makeFirmwareQuickPickItems(candidates), {
      title: "Select firmware",
      placeHolder: "Select .hex or .bin firmware",
    });
    if (!picked) return null;
    await updateWorkspaceSetting(this.vscode, "firmware", picked.candidate.relativePath);
    this.refreshViews();
    return picked.candidate;
  }

  async showFirmwareInfo(uri) {
    const target = uri ?? this.vscode.window.activeTextEditor?.document?.uri;
    let candidate = null;
    if (target?.fsPath && isFirmwarePath(target.fsPath)) {
      candidate = firmwareCandidateFromUri(this.vscode, target);
      const info = await stat(candidate.path);
      candidate.size = info.size;
      candidate.mtimeMs = info.mtimeMs;
    } else {
      candidate = await this.resolveFirmwareForFlash();
    }
    if (!candidate) return;

    const firmware = await loadFirmwareCandidate(candidate);
    const address = firmware.baseAddress ?? 0x08000000;
    const lines = [
      `Firmware: ${candidate.relativePath}`,
      `Format: ${firmware.format.toUpperCase()}`,
      `Bytes: ${firmware.bytes.length}`,
      `Base address: ${firmware.baseAddress === null ? "default " : ""}${toHex(address, 8)}`,
      `Modified: ${candidate.mtimeMs ? new Date(candidate.mtimeMs).toLocaleString() : "unknown"}`,
      `Path: ${candidate.path}`,
    ];
    this.output.show();
    lines.forEach((line) => this.output.append(line));
    this.vscode.window.showInformationMessage(lines.slice(0, 4).join(" | "), "Open Output").then((action) => {
      if (action === "Open Output") this.output.show();
    });
  }

  async resolveFirmwareForFlash() {
    const settings = readFlashSettings(this.vscode, this.context);
    const rememberedPath = resolveWorkspacePath(this.vscode, settings.firmware);
    if (settings.firmware && await exists(rememberedPath)) {
      return {
        path: rememberedPath,
        relativePath: settings.firmware,
        size: undefined,
        mtimeMs: Date.now(),
        score: 1000,
      };
    }

    if (settings.autoDiscoverFirmware === false) {
      this.vscode.window.showWarningMessage("SerialFlash firmware auto discovery is disabled. Use Select Firmware or configure serialFlash.firmware.");
      return null;
    }

    const candidates = await discoverFirmware(this.vscode, {
      rememberedPath: settings.firmware,
      firmwareGlobs: settings.firmwareGlobs,
      excludeGlobs: settings.excludeGlobs,
    });
    if (candidates.length === 0) {
      this.vscode.window.showWarningMessage("工作区中没有找到 .hex 或 .bin 固件。");
      return null;
    }
    if (canAutoSelectFirmware(candidates)) {
      await updateWorkspaceSetting(this.vscode, "firmware", candidates[0].relativePath);
      return candidates[0];
    }
    return this.selectFirmware();
  }

  async selectSerialPort(forcePick = false) {
    const settings = readFlashSettings(this.vscode, this.context);
    const ports = sortPorts(await listSerialPorts());
    if (ports.length === 0) {
      this.vscode.window.showWarningMessage("没有发现串口设备。");
      return "";
    }
    if (!forcePick && settings.port && ports.some((port) => port.path === settings.port)) {
      return settings.port;
    }
    const picked = await this.vscode.window.showQuickPick(makeSerialPortQuickPickItems(ports, settings.port), {
      title: "Select serial port",
      placeHolder: "Select a local serial device",
    });
    if (!picked) return "";
    await updateWorkspaceSetting(this.vscode, "port", picked.port.path);
    this.syncStatusBarFromSettings({ ...settings, port: picked.port.path });
    this.refreshViews();
    return picked.port.path;
  }

  async selectResetMode() {
    const settings = readFlashSettings(this.vscode, this.context);
    const picked = await this.vscode.window.showQuickPick(RESET_MODES.map((mode) => ({
      label: mode.label,
      description: mode.id === settings.resetMode ? "last used" : mode.id,
      detail: mode.description,
      mode,
    })), {
      title: "Select reset mode",
    });
    if (!picked) return "";
    await updateWorkspaceSetting(this.vscode, "resetMode", picked.mode.id);
    this.refreshViews();
    return picked.mode.id;
  }

  async flashCandidate(candidate) {
    if (this.isFlashing) {
      this.vscode.window.showWarningMessage("SerialFlash is already flashing.");
      return;
    }
    const settings = readFlashSettings(this.vscode, this.context);
    const port = await this.selectSerialPort(false);
    if (!port) return;
    await this.closeActivePort({ silent: true });

    const firmware = await loadFirmwareCandidate(candidate);
    const address = settings.flashAddress
      ? parseAddress(settings.flashAddress)
      : (firmware.baseAddress ?? 0x08000000);
    const activeSettings = {
      ...settings,
      port,
      firmware: candidate.relativePath,
      flashAddress: toHex(address, 8),
    };

    this.output.show();
    this.output.append(`Firmware: ${candidate.relativePath}, ${firmware.format.toUpperCase()}, ${firmware.bytes.length} bytes`);
    this.output.append(`Port: ${port} @ ${settings.baudRate} 8${settings.parity === "even" ? "E" : "N"}1`);
    this.output.append(`Reset: ${settings.resetMode}`);
    const resetConfig = resolveResetConfig(settings);

    const transport = await createSerialTransport(port, {
      baudRate: settings.baudRate,
      parity: settings.parity,
      log: (message) => this.output.append(message),
    });

    this.isFlashing = true;
    this.abortController = new AbortController();
    this.statusBar.command = "serialFlash.showOutput";
    this.statusBar.text = "SerialFlash: Flashing";
    this.postPanelState({ running: true, progress: 0, error: "", troubleshooting: [] });

    try {
      await flashStm32Uart({
        transport,
        firmware,
        address,
        packetSize: settings.packetSize,
        timeout: settings.timeout,
        resetMode: resetConfig,
        erase: settings.eraseBeforeWrite,
        verify: settings.verifyAfterWrite,
        run: settings.runAfterWrite,
        unlock: settings.unlockReadProtection,
        close: settings.closePortAfterWrite,
        signal: this.abortController.signal,
        onLog: (message) => this.output.append(message),
        onProgress: ({ phase, percent }) => {
          this.statusBar.text = `SerialFlash: ${phase} ${percent}%`;
          this.postPanelState({ running: true, progress: percent, phase });
        },
      });
      this.activeTransport = settings.closePortAfterWrite ? null : transport;
      await rememberSuccessfulFlash(this.vscode, this.context, activeSettings);
      await recordFlashHistory(this.context, {
        success: true,
        firmware: candidate.relativePath,
        port,
        resetMode: settings.resetMode,
        address: toHex(address, 8),
        bytes: firmware.bytes.length,
        format: firmware.format,
      });
      this.statusBar.text = "SerialFlash: Done";
      this.statusBar.command = "serialFlash.openPanel";
      this.postPanelState({ running: false, progress: 100, error: "", troubleshooting: [] });
      this.refreshViews();
      this.vscode.window.showInformationMessage("SerialFlash: 烧录完成。");
    } catch (error) {
      await recordFlashHistory(this.context, {
        success: false,
        firmware: candidate.relativePath,
        port,
        resetMode: settings.resetMode,
        address: toHex(address, 8),
        bytes: firmware.bytes.length,
        format: firmware.format,
        error: error.message,
      });
      this.output.append(`Error: ${error.message}`);
      const hints = appendTroubleshooting(this.output, error, {
        port,
        resetMode: settings.resetMode,
        firmware: candidate.relativePath,
      });
      this.statusBar.text = "SerialFlash: Error";
      this.statusBar.command = "serialFlash.showOutput";
      this.postPanelState({ running: false, error: error.message, troubleshooting: hints });
      this.refreshViews();
      const action = await this.vscode.window.showErrorMessage(
        `SerialFlash failed: ${error.message}. ${hints[0]}`,
        "Select Port",
        "Select Reset Mode",
        "Run Diagnostics",
        "Open Output",
      );
      if (action === "Select Port") await this.selectSerialPort(true);
      if (action === "Select Reset Mode") await this.selectResetMode();
      if (action === "Run Diagnostics") await this.runDiagnostics();
      if (action === "Open Output") this.output.show();
    } finally {
      this.isFlashing = false;
      this.abortController = null;
    }
  }

  cancelFlash() {
    if (!this.abortController) {
      this.vscode.window.showInformationMessage("SerialFlash: no active flash operation.");
      return;
    }
    this.abortController.abort();
    this.output.append("Cancel requested");
    this.statusBar.text = "SerialFlash: Cancelling";
    this.refreshViews({ phase: "Cancelling" });
  }

  async closeActivePort({ silent = false } = {}) {
    if (!this.activeTransport) return;
    const transport = this.activeTransport;
    this.activeTransport = null;
    await transport.close();
    this.syncStatusBarFromSettings();
    this.refreshViews();
    if (!silent) this.vscode.window.showInformationMessage("SerialFlash serial port closed.");
  }

  async resetToBootloader() {
    await this.runResetAction("Entering bootloader", enterBootloader);
  }

  async runDiagnostics() {
    const diagnostics = await collectDiagnostics(this.vscode);
    this.output.show();
    for (const line of formatDiagnostics(diagnostics)) {
      this.output.append(line);
    }
    this.refreshViews({ diagnostics });
    if (diagnostics.serialport.loaded) {
      this.vscode.window.showInformationMessage(`SerialFlash diagnostics complete: ${diagnostics.ports.length} port(s) found.`);
    } else {
      this.vscode.window.showErrorMessage(`SerialFlash diagnostics failed: ${diagnostics.serialport.error}`);
    }
    return diagnostics;
  }

  async resetAndRun() {
    await this.runResetAction("Reset and run", resetToRun);
  }

  async eraseChip() {
    const confirmed = await this.vscode.window.showWarningMessage(
      "Erase Chip will mass erase the connected STM32.",
      { modal: true },
      "Erase Chip",
    );
    if (confirmed !== "Erase Chip") return;
    await this.runBootloaderAction("Erase chip", async (bootloader) => {
      const mode = await bootloader.massErase();
      this.output.append(`Erase complete (${mode})`);
    });
  }

  async verifyLatestFirmware(uri) {
    const candidate = uri?.fsPath && isFirmwarePath(uri.fsPath)
      ? firmwareCandidateFromUri(this.vscode, uri)
      : await this.resolveFirmwareForFlash();
    if (!candidate) return;
    const settings = readFlashSettings(this.vscode, this.context);
    const firmware = await loadFirmwareCandidate(candidate);
    const address = settings.flashAddress
      ? parseAddress(settings.flashAddress)
      : (firmware.baseAddress ?? 0x08000000);
    await this.runBootloaderAction("Verify firmware", async (bootloader) => {
      await bootloader.verify(address, firmware.bytes, settings.packetSize);
      this.output.append(`Verify complete: ${candidate.relativePath}`);
    });
  }

  async unlockReadProtection() {
    const confirmed = await this.vscode.window.showWarningMessage(
      "Unlock Read Protection will erase the whole chip.",
      { modal: true },
      "Unlock And Erase",
    );
    if (confirmed !== "Unlock And Erase") return;
    await this.runBootloaderAction("Unlock read protection", async (bootloader) => {
      await bootloader.readoutUnprotect();
      this.output.append("Read protection unlock command complete");
    });
  }

  async runBootloaderAction(label, action) {
    const settings = readFlashSettings(this.vscode, this.context);
    const port = await this.selectSerialPort(false);
    if (!port) return;
    await this.closeActivePort({ silent: true });
    const transport = await createSerialTransport(port, {
      baudRate: settings.baudRate,
      parity: settings.parity,
      log: (message) => this.output.append(message),
    });
    const bootloader = new Stm32Bootloader(transport, { timeout: settings.timeout });

    this.output.show();
    this.output.append(`${label}: ${port}, reset=${settings.resetMode}`);
    await transport.open();
    try {
      const resetConfig = resolveResetConfig(settings);
      await enterBootloader(transport, delay, resetConfig);
      const ignored = await syncBootloaderIgnoringNoise(transport, settings.timeout);
      if (ignored.length > 0) {
        const preview = ignored.slice(0, 16).map((byte) => toHex(byte)).join(" ");
        const suffixText = ignored.length > 16 ? " ..." : "";
        this.output.append(`Ignored ${ignored.length} non-bootloader byte(s) before ACK: ${preview}${suffixText}`);
      }
      const info = await bootloader.getCommands();
      const chipId = await bootloader.getId();
      this.output.append(`Bootloader ${toHex(info.version)}, PID ${toHex(chipId, 4)}`);
      await action(bootloader);
    } catch (error) {
      const hints = appendTroubleshooting(this.output, error, {
        port,
        resetMode: settings.resetMode,
      });
      this.vscode.window.showErrorMessage(`${label} failed: ${error.message}. ${hints[0]}`, "Run Diagnostics", "Open Output").then((choice) => {
        if (choice === "Run Diagnostics") this.runDiagnostics();
        if (choice === "Open Output") this.output.show();
      });
      throw error;
    } finally {
      await transport.close();
    }
  }

  async runResetAction(label, action) {
    const settings = readFlashSettings(this.vscode, this.context);
    const port = await this.selectSerialPort(false);
    if (!port) return;
    await this.closeActivePort({ silent: true });
    const transport = await createSerialTransport(port, {
      baudRate: settings.baudRate,
      parity: settings.parity,
      log: (message) => this.output.append(message),
    });

    this.output.show();
    this.output.append(`${label}: ${port}, reset=${settings.resetMode}`);
    await transport.open();
    try {
      await action(transport, delay, resolveResetConfig(settings));
      this.output.append(`${label} complete`);
    } catch (error) {
      const hints = troubleshootingHints(error, {
        port,
        resetMode: settings.resetMode,
      });
      this.output.append(`Error: ${error.message}`);
      this.output.append("Troubleshooting:");
      hints.forEach((hint) => this.output.append(`- ${hint}`));
      this.vscode.window.showErrorMessage(`${label} failed: ${error.message}. ${hints[0]}`, "Select Reset Mode", "Open Output").then((choice) => {
        if (choice === "Select Reset Mode") this.selectResetMode();
        if (choice === "Open Output") this.output.show();
      });
      throw error;
    } finally {
      await transport.close();
    }
  }

  async clearRememberedDevice() {
    await Promise.all([
      this.context.globalState.update(GLOBAL_KEYS.port, undefined),
      this.context.globalState.update(GLOBAL_KEYS.firmware, undefined),
      this.context.globalState.update(GLOBAL_KEYS.resetMode, undefined),
      this.context.globalState.update(GLOBAL_KEYS.baudRate, undefined),
      updateWorkspaceSetting(this.vscode, "port", undefined),
    ]);
    this.syncStatusBarFromSettings({ port: "" });
    this.refreshViews();
    this.vscode.window.showInformationMessage("SerialFlash remembered device cleared.");
  }

  async createProjectConfig() {
    const settings = readFlashSettings(this.vscode, this.context);
    const path = await writeProjectSettings(this.vscode, settings);
    this.refreshViews();
    this.vscode.window.showInformationMessage(`SerialFlash project config written: ${path}`);
  }

  async createTasks() {
    const path = await writeProjectTasks(this.vscode);
    this.vscode.window.showInformationMessage(`SerialFlash tasks written: ${path}`);
  }

  async createProjectProfile() {
    const settings = readFlashSettings(this.vscode, this.context);
    const name = await this.vscode.window.showInputBox({
      title: "Create SerialFlash Project Profile",
      prompt: "Profile name",
      value: settings.firmware ? settings.firmware.split(/[\\/]/).at(-1) : "default",
      validateInput: (value) => value.trim() ? undefined : "Profile name is required",
    });
    if (!name) return;

    const profile = projectProfileFromState(name.trim(), settings);
    const projects = [
      profile,
      ...settings.projects.filter((item) => item.name !== profile.name),
    ];
    await updateWorkspaceSetting(this.vscode, "projects", projects);
    this.refreshViews();
  }

  async selectProjectProfile() {
    const settings = readFlashSettings(this.vscode, this.context);
    if (settings.projects.length === 0) {
      this.vscode.window.showWarningMessage("No SerialFlash project profiles configured.");
      return null;
    }
    const picked = await this.vscode.window.showQuickPick(settings.projects.map((profile) => ({
      label: profile.name,
      description: profile.firmware || "",
      detail: [profile.port, profile.resetMode, profile.baudRate && `${profile.baudRate} baud`].filter(Boolean).join(" / "),
      profile,
    })), {
      title: "Select SerialFlash Project Profile",
    });
    if (!picked) return null;
    await applyFlashSettings(this.vscode, picked.profile);
    this.syncStatusBarFromSettings(picked.profile);
    this.refreshViews();
    return picked.profile;
  }

  async clearHistory() {
    await clearFlashHistory(this.context);
    this.refreshViews();
  }

  async updateSetting(key, value) {
    await updateWorkspaceSetting(this.vscode, key, value);
    if (key === "port") {
      this.syncStatusBarFromSettings({ ...readFlashSettings(this.vscode, this.context), port: value || "" });
    }
    this.refreshViews();
  }

  openPanel() {
    if (!this.panelFactory) return;
    this.panelFactory.show(this);
  }

  panelState(extra = {}) {
    const settings = readFlashSettings(this.vscode, this.context);
    this.lastPanelState = {
      ...this.lastPanelState,
      ...extra,
    };
    return {
      settings,
      history: readFlashHistory(this.context),
      log: this.output.recent?.() ?? [],
      diagnostics: this.lastPanelState.diagnostics,
      running: this.isFlashing,
      ...this.lastPanelState,
    };
  }

  postPanelState(extra = {}) {
    this.panelFactory?.postState?.(this.panelState(extra));
  }

  refreshViews(extra = {}) {
    this.sidebarProvider?.refresh();
    this.postPanelState(extra);
  }
}
