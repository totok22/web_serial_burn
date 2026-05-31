import { Stm32Bootloader, toHex } from "./stm32.js";
import { SerialTransport, enterBootloader, resetToRun } from "./serial-transport.js";
import { loadFirmwareFile } from "./firmware.js";

const $ = (id) => document.getElementById(id);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const i18n = {
  zh: {
    eyebrow: "Web Serial / 多目标 ISP",
    appTitle: "Web MCU 烧录器",
    connection: "连接",
    target: "目标",
    baudRate: "波特率",
    timeout: "读取超时 ms",
    parity: "校验位",
    flashBase: "Flash 起始地址",
    packetBytes: "分包字节",
    boot0: "BOOT0 高电平信号",
    reset: "RESET 触发信号",
    connect: "连接",
    disconnect: "断开",
    enterBoot: "进入 Bootloader",
    resetRun: "复位运行",
    firmware: "固件",
    chooseFirmware: "选择固件",
    noFile: "未加载文件",
    doErase: "写入前全片擦除",
    doVerify: "写入后校验",
    doRun: "成功后复位运行",
    doUnlock: "遇到读保护时解锁",
    sync: "同步",
    readPid: "读取 PID",
    erase: "擦除",
    flashVerify: "烧录 + 校验",
    process: "流程",
    autoProgram: "自动编程",
    stepConnect: "连接串口",
    stepBoot: "进入 Bootloader",
    stepSync: "同步并读取命令",
    stepErase: "擦除 Flash",
    stepWrite: "分块写入固件",
    stepVerify: "读回并比对",
    stepRun: "复位到用户程序",
    manual: "手动控制台",
    sendHex: "发送 HEX",
    readByte: "读 1 字节",
    log: "日志",
    clear: "清空",
    serialOk: "Web Serial 可用",
    serialNo: "Web Serial 不可用",
  },
  en: {
    eyebrow: "Web Serial / Multi-target ISP",
    appTitle: "Web MCU Burner",
    connection: "Connection",
    target: "Target",
    baudRate: "Baud rate",
    timeout: "Read timeout ms",
    parity: "Parity",
    flashBase: "Flash base",
    packetBytes: "Packet bytes",
    boot0: "BOOT0 high signal",
    reset: "RESET assert signal",
    connect: "Connect",
    disconnect: "Disconnect",
    enterBoot: "Enter Bootloader",
    resetRun: "Reset Run",
    firmware: "Firmware",
    chooseFirmware: "Choose firmware",
    noFile: "No file loaded",
    doErase: "Mass erase before write",
    doVerify: "Verify after write",
    doRun: "Reset to run after success",
    doUnlock: "Unlock if protected",
    sync: "Sync",
    readPid: "Read PID",
    erase: "Erase",
    flashVerify: "Flash + Verify",
    process: "Process",
    autoProgram: "Auto Program",
    stepConnect: "Connect serial port",
    stepBoot: "Enter bootloader",
    stepSync: "Sync and inspect commands",
    stepErase: "Erase flash",
    stepWrite: "Write firmware blocks",
    stepVerify: "Read back and compare",
    stepRun: "Reset into user program",
    manual: "Manual Console",
    sendHex: "Send HEX",
    readByte: "Read Byte",
    log: "Log",
    clear: "Clear",
    serialOk: "Web Serial available",
    serialNo: "Web Serial unavailable",
  },
};

const state = {
  lang: localStorage.getItem("lang") || "zh",
  port: null,
  transport: null,
  bootloader: null,
  firmware: null,
  firmwareName: "",
  connected: false,
};

const els = {
  languageSelect: $("languageSelect"),
  supportStatus: $("supportStatus"),
  targetProfile: $("targetProfile"),
  baudRate: $("baudRate"),
  timeoutMs: $("timeoutMs"),
  parity: $("parity"),
  flashBase: $("flashBase"),
  packetSize: $("packetSize"),
  boot0High: $("boot0High"),
  resetAssert: $("resetAssert"),
  connectBtn: $("connectBtn"),
  disconnectBtn: $("disconnectBtn"),
  bootBtn: $("bootBtn"),
  runBtn: $("runBtn"),
  firmwareInput: $("firmwareInput"),
  firmwareName: $("firmwareName"),
  firmwareSize: $("firmwareSize"),
  chipId: $("chipId"),
  doErase: $("doErase"),
  doVerify: $("doVerify"),
  doRun: $("doRun"),
  doUnlock: $("doUnlock"),
  syncBtn: $("syncBtn"),
  pidBtn: $("pidBtn"),
  eraseBtn: $("eraseBtn"),
  flashBtn: $("flashBtn"),
  fullProcessBtn: $("fullProcessBtn"),
  dtrLowBtn: $("dtrLowBtn"),
  dtrHighBtn: $("dtrHighBtn"),
  rtsLowBtn: $("rtsLowBtn"),
  rtsHighBtn: $("rtsHighBtn"),
  hexInput: $("hexInput"),
  sendHexBtn: $("sendHexBtn"),
  readByteBtn: $("readByteBtn"),
  progressBar: $("progressBar"),
  log: $("log"),
  clearLogBtn: $("clearLogBtn"),
  steps: $("steps"),
};

function t(key) {
  return i18n[state.lang][key] ?? i18n.en[key] ?? key;
}

function applyLanguage() {
  document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en";
  els.languageSelect.value = state.lang;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  if (!state.firmware) els.firmwareSize.textContent = t("noFile");
  if (!state.firmware) els.firmwareName.textContent = t("chooseFirmware");
  updateUi();
}

function log(message, level = "info") {
  const stamp = new Date().toLocaleTimeString();
  els.log.textContent += `[${stamp}] ${level.toUpperCase()} ${message}\n`;
  els.log.scrollTop = els.log.scrollHeight;
}

function setProgress(value) {
  els.progressBar.style.width = `${Math.max(0, Math.min(100, value))}%`;
}

function setStep(name, status) {
  const step = els.steps.querySelector(`[data-step="${name}"]`);
  if (step) step.dataset.status = status;
}

function parseNumber(value, label) {
  const parsed = value.trim().startsWith("0x") ? Number.parseInt(value, 16) : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}`);
  return parsed >>> 0;
}

function options() {
  return {
    target: els.targetProfile.value,
    baudRate: Number.parseInt(els.baudRate.value, 10),
    timeout: Number.parseInt(els.timeoutMs.value, 10),
    parity: els.parity.value,
    flashBase: parseNumber(els.flashBase.value, "flash base"),
    packetSize: Number.parseInt(els.packetSize.value, 10),
    boot0High: els.boot0High.value,
    resetAssert: els.resetAssert.value,
    boot0Low: els.boot0High.value.replace("true", "TMP").replace("false", "true").replace("TMP", "false"),
    doErase: els.doErase.checked,
    doVerify: els.doVerify.checked,
    doRun: els.doRun.checked,
    doUnlock: els.doUnlock.checked,
  };
}

function ensureStm32() {
  if (options().target !== "stm32-uart") {
    throw new Error("Automatic protocol actions currently support STM32 UART ISP only. Use manual console for other targets.");
  }
}

function updateUi() {
  const supported = "serial" in navigator;
  const stm32 = els.targetProfile.value === "stm32-uart";
  els.supportStatus.textContent = supported ? t("serialOk") : t("serialNo");
  els.supportStatus.dataset.ok = supported ? "true" : "false";

  els.connectBtn.disabled = !supported || state.connected;
  els.disconnectBtn.disabled = !state.connected;
  els.bootBtn.disabled = !state.connected;
  els.runBtn.disabled = !state.connected;
  els.syncBtn.disabled = !state.connected || !stm32;
  els.pidBtn.disabled = !state.connected || !stm32;
  els.eraseBtn.disabled = !state.connected || !stm32;
  els.flashBtn.disabled = !state.connected || !state.firmware || !stm32;
  els.fullProcessBtn.disabled = !state.connected || !state.firmware || !stm32;
  [els.dtrLowBtn, els.dtrHighBtn, els.rtsLowBtn, els.rtsHighBtn, els.sendHexBtn, els.readByteBtn].forEach((button) => {
    button.disabled = !state.connected;
  });
}

function createBootloader() {
  const { timeout } = options();
  state.bootloader = new Stm32Bootloader(state.transport, {
    timeout,
    onProgress: ({ phase, offset, total }) => {
      const base = phase === "write" ? 35 : 70;
      const span = phase === "write" ? 35 : 25;
      setProgress(base + (offset / total) * span);
    },
  });
}

async function connect() {
  const config = options();
  state.port = await navigator.serial.requestPort();
  state.transport = new SerialTransport(state.port, log);
  await state.transport.open({
    baudRate: config.baudRate,
    dataBits: 8,
    stopBits: 1,
    parity: config.parity,
    flowControl: "none",
  });
  state.connected = true;
  createBootloader();
  setStep("connect", "done");
  log(`Serial opened: ${config.baudRate} 8${config.parity[0].toUpperCase()}1.`);
}

async function disconnect() {
  if (state.transport) await state.transport.close();
  state.connected = false;
  state.port = null;
  state.transport = null;
  state.bootloader = null;
  log("Serial port closed.");
}

async function runAction(label, action) {
  try {
    log(`${label}...`);
    await action();
    log(`${label} complete.`);
  } catch (error) {
    log(`${label} failed: ${error.message}`, "error");
  } finally {
    updateUi();
  }
}

async function syncAndReadCommands() {
  ensureStm32();
  await state.bootloader.sync();
  const info = await state.bootloader.getCommands();
  const commands = Array.from(info.commands, (cmd) => toHex(cmd)).join(", ");
  log(`STM32 bootloader version ${toHex(info.version)}; commands: ${commands}`);
  setStep("sync", "done");
}

async function readPid() {
  ensureStm32();
  const pid = await state.bootloader.getId();
  els.chipId.textContent = `PID: ${toHex(pid, 4)}`;
  log(`Chip PID ${toHex(pid, 4)}`);
}

async function erase() {
  ensureStm32();
  try {
    const mode = await state.bootloader.massErase();
    log(`Mass erase finished using ${mode} erase.`);
  } catch (error) {
    if (!/NACK/i.test(error.message) || !options().doUnlock) throw error;
    log("Erase returned NACK; attempting readout unprotect. This clears flash and resets the chip.", "warn");
    await state.bootloader.readoutUnprotect();
    await enterBootloader(state.transport, delay, options());
    createBootloader();
    await syncAndReadCommands();
  }
  setStep("erase", "done");
  setProgress(30);
}

async function flashAndVerify() {
  ensureStm32();
  const config = options();
  if (config.doErase) await erase();
  await state.bootloader.writeMemory(config.flashBase, state.firmware, config.packetSize);
  setStep("write", "done");
  if (config.doVerify) {
    await state.bootloader.verify(config.flashBase, state.firmware, config.packetSize);
    setStep("verify", "done");
  }
  setProgress(config.doVerify ? 100 : 90);
}

async function autoProgram() {
  ensureStm32();
  setProgress(0);
  await enterBootloader(state.transport, delay, options());
  setStep("boot", "done");
  await syncAndReadCommands();
  await readPid();
  await flashAndVerify();
  if (options().doRun) {
    await resetToRun(state.transport, delay, options());
    setStep("run", "done");
  }
}

function parseHex(input) {
  const clean = input.replace(/0x/gi, " ").replace(/[^0-9a-fA-F]/g, " ").trim();
  if (!clean) return [];
  return clean.split(/\s+/).map((part) => {
    const value = Number.parseInt(part, 16);
    if (!Number.isFinite(value) || value < 0 || value > 255) throw new Error(`Invalid byte: ${part}`);
    return value;
  });
}

async function sendHex() {
  const bytes = parseHex(els.hexInput.value);
  await state.transport.write(bytes);
  log(`TX ${bytes.map((byte) => toHex(byte)).join(" ")}`);
}

async function readByte() {
  const byte = (await state.transport.readExact(1, options().timeout))[0];
  log(`RX ${toHex(byte)}`);
}

els.languageSelect.addEventListener("change", () => {
  state.lang = els.languageSelect.value;
  localStorage.setItem("lang", state.lang);
  applyLanguage();
});
els.targetProfile.addEventListener("change", updateUi);
els.connectBtn.addEventListener("click", () => runAction(t("connect"), connect));
els.disconnectBtn.addEventListener("click", () => runAction(t("disconnect"), disconnect));
els.bootBtn.addEventListener("click", () => runAction(t("enterBoot"), async () => {
  await enterBootloader(state.transport, delay, options());
  setStep("boot", "done");
}));
els.runBtn.addEventListener("click", () => runAction(t("resetRun"), async () => {
  await resetToRun(state.transport, delay, options());
  setStep("run", "done");
}));
els.syncBtn.addEventListener("click", () => runAction(t("sync"), syncAndReadCommands));
els.pidBtn.addEventListener("click", () => runAction(t("readPid"), readPid));
els.eraseBtn.addEventListener("click", () => runAction(t("erase"), erase));
els.flashBtn.addEventListener("click", () => runAction(t("flashVerify"), flashAndVerify));
els.fullProcessBtn.addEventListener("click", () => runAction(t("autoProgram"), autoProgram));
els.dtrLowBtn.addEventListener("click", () => runAction("DTR 0", () => state.transport.setSignals({ dataTerminalReady: true })));
els.dtrHighBtn.addEventListener("click", () => runAction("DTR 1", () => state.transport.setSignals({ dataTerminalReady: false })));
els.rtsLowBtn.addEventListener("click", () => runAction("RTS 0", () => state.transport.setSignals({ requestToSend: true })));
els.rtsHighBtn.addEventListener("click", () => runAction("RTS 1", () => state.transport.setSignals({ requestToSend: false })));
els.sendHexBtn.addEventListener("click", () => runAction(t("sendHex"), sendHex));
els.readByteBtn.addEventListener("click", () => runAction(t("readByte"), readByte));
els.clearLogBtn.addEventListener("click", () => {
  els.log.textContent = "";
});

els.firmwareInput.addEventListener("change", async () => {
  const file = els.firmwareInput.files[0];
  if (!file) return;
  state.firmwareName = file.name;
  const firmware = await loadFirmwareFile(file);
  state.firmware = firmware.bytes;
  if (firmware.baseAddress !== null) {
    els.flashBase.value = toHex(firmware.baseAddress, 8);
  }
  els.firmwareName.textContent = file.name;
  els.firmwareSize.textContent = `${firmware.format.toUpperCase()} / ${state.firmware.length.toLocaleString()} bytes`;
  log(`Loaded ${firmware.format.toUpperCase()} firmware ${file.name} (${state.firmware.length} bytes).`);
  updateUi();
});

window.addEventListener("beforeunload", () => {
  if (state.connected) state.transport?.close();
});

if (!("serial" in navigator)) {
  log("Web Serial is only available in Chromium-based browsers on HTTPS or localhost.", "warn");
}
applyLanguage();
