import { ACK, COMMANDS, NACK, SYNC, Stm32Bootloader, addressPacket, toHex } from "./stm32.js";
import { SerialTransport, bootloaderEntryStages, enterBootloader, resetToRun } from "./serial-transport.js";
import { loadFirmwareFile } from "./firmware.js";

const $ = (id) => document.getElementById(id);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const i18n = {
  zh: {
    eyebrow: "Web Serial / STM32 UART ISP",
    appTitle: "Web MCU Burner",
    settingsTitle: "烧写设置",
    target: "目标协议",
    selectPort: "请选择串口",
    chooseFirmware: "点击选择固件文件 (.bin / .hex)",
    noFile: "未加载文件",
    resetLogicTitle: "DTR/RTS 复位模式",
    resetMode1: "通用：DTR高电平复位，RTS低电平进BootLoader",
    resetMode2: "CH340C 经典三极管电路 (已验证)",
    resetModeCh340x: "CH340X 直连电路",
    circuitHelp: "电路说明",
    circuitCh340c: "CH340C 经典三极管电路：DTR/RTS 经过外部三极管控制 RESET 和 BOOT0，已验证入口序列为 RTS低电平、DTR低电平复位、DTR高电平释放。",
    circuitCh340x: "CH340X 直连电路：DTR#/RTS# 直接参与 RESET/BOOT0 控制，使用先压住复位并建立 BOOT 条件、再释放复位的自动时序。",
    resetModeCustom: "自定义 DTR/RTS 映射",
    resetModeNone: "不使用控制线 (手动按键进Boot)",
    advancedSettings: "高级设置...",
    flashBase: "Flash 起始地址 (Hex)",
    packetBytes: "写入分包大小 (Bytes)",
    parity: "奇偶校验位",
    timeout: "读取超时 (ms)",
    boot0: "BOOT0 高电平信号",
    reset: "RESET 触发信号",
    doErase: "烧录前全片擦除",
    doVerify: "烧录后完整校验（较慢）",
    doRun: "烧录成功后复位并运行程序",
    doUnlock: "若发生读保护，自动解除保护 (将擦除全片)",
    startProgram: "开始编程",
    openPort: "开启串口",
    closePort: "关闭串口",
    clear: "清空日志",
    executionLog: "执行日志",
    stepPort: "打开串口连接",
    stepBoot: "进入 Bootloader 模式",
    stepSync: "握手同步并读取芯片信息",
    stepErase: "擦除芯片 Flash",
    stepWrite: "分块写入固件数据",
    stepVerify: "读回固件进行一致性校验",
    stepRun: "复位并启动用户程序",
    manualConsole: "调试控制台",
    forceBoot: "强驱进Boot",
    forceRun: "强驱复位运行",
    sendHex: "发送 HEX",
    readByte: "读 1 字节",
    serialOk: "Web Serial API (就绪)",
    serialNo: "Web Serial 浏览器不支持该特性",
  },
  en: {
    eyebrow: "Web Serial / STM32 UART ISP",
    appTitle: "Web MCU Burner",
    settingsTitle: "Programming Settings",
    target: "Target protocol",
    selectPort: "Select Serial Port",
    chooseFirmware: "Click to select firmware (.bin / .hex)",
    noFile: "No file loaded",
    resetLogicTitle: "DTR/RTS reset mode",
    resetMode1: "Generic: DTR high reset, RTS low bootloader",
    resetMode2: "Classic CH340C transistor circuit (verified)",
    resetModeCh340x: "CH340X direct circuit",
    circuitHelp: "Circuit notes",
    circuitCh340c: "Classic CH340C transistor circuit: DTR/RTS drive RESET and BOOT0 through external transistors. Verified entry sequence: RTS low, DTR low reset, DTR high release.",
    circuitCh340x: "CH340X direct circuit: DTR#/RTS# directly participate in RESET/BOOT0 control. The preset holds reset while setting BOOT, then releases reset automatically.",
    resetModeCustom: "Custom DTR/RTS mapping",
    resetModeNone: "No control flow (Manual boot)",
    advancedSettings: "Advanced settings...",
    flashBase: "Flash base address (Hex)",
    packetBytes: "Write packet size (Bytes)",
    parity: "Parity",
    timeout: "Read timeout (ms)",
    boot0: "BOOT0 high signal",
    reset: "RESET assert signal",
    doErase: "Mass erase before writing",
    doVerify: "Full verify after writing (slower)",
    doRun: "Reset and run program upon success",
    doUnlock: "Auto-unlock readout protection (erases chip)",
    startProgram: "Start Programming",
    openPort: "Open Port",
    closePort: "Close Port",
    clear: "Clear Log",
    executionLog: "Execution Log",
    stepPort: "Open serial port connection",
    stepBoot: "Enter Bootloader mode",
    stepSync: "Handshake sync and read chip info",
    stepErase: "Erase Flash memory",
    stepWrite: "Write firmware data blocks",
    stepVerify: "Verify written data consistency",
    stepRun: "Reset and start user program",
    manualConsole: "Debug Console",
    forceBoot: "Force Boot",
    forceRun: "Force Run",
    sendHex: "Send HEX",
    readByte: "Read Byte",
    serialOk: "Web Serial API (Ready)",
    serialNo: "Web Serial not supported in this browser",
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
  portName: $("portName"),
  targetProfile: $("targetProfile"),
  baudRate: $("baudRate"),
  resetLogic: $("resetLogic"),
  flashBase: $("flashBase"),
  packetSize: $("packetSize"),
  parity: $("parity"),
  timeoutMs: $("timeoutMs"),
  boot0High: $("boot0High"),
  resetAssert: $("resetAssert"),
  firmwareInput: $("firmwareInput"),
  firmwareName: $("firmwareName"),
  firmwareSize: $("firmwareSize"),
  doErase: $("doErase"),
  doVerify: $("doVerify"),
  doRun: $("doRun"),
  doUnlock: $("doUnlock"),
  selectPortBtn: $("selectPortBtn"),
  connectBtn: $("connectBtn"),
  disconnectBtn: $("disconnectBtn"),
  fullProcessBtn: $("fullProcessBtn"),
  clearLogBtn: $("clearLogBtn"),
  log: $("log"),
  steps: document.querySelectorAll("#steps li"),
  progressBar: $("progressBar"),

  // 调试控制台元素
  enterBootBtn: $("enterBootBtn"),
  resetRunBtn: $("resetRunBtn"),
  dtrLowBtn: $("dtrLowBtn"),
  dtrHighBtn: $("dtrHighBtn"),
  rtsLowBtn: $("rtsLowBtn"),
  rtsHighBtn: $("rtsHighBtn"),
  hexInput: $("hexInput"),
  sendHexBtn: $("sendHexBtn"),
  readByteBtn: $("readByteBtn")
};

function t(key) {
  return i18n[state.lang][key] ?? (i18n.en[key] ?? key);
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
  const color = level === "error" ? "var(--danger)" : level === "warn" ? "var(--warn)" : "var(--text)";
  const el = document.createElement('div');
  el.style.color = color;
  el.textContent = `[${stamp}] ${message}`;
  els.log.appendChild(el);
  els.log.scrollTop = els.log.scrollHeight;
}

function setProgress(value) {
  els.progressBar.style.width = `${Math.max(0, Math.min(100, value))}%`;
}

function resetSteps() {
    els.steps.forEach(step => {
        step.dataset.status = "";
    });
}

function setStep(name, status) {
  const step = Array.from(els.steps).find(el => el.dataset.step === name);
  if (step) {
      // clear active from others if we are setting to active
      if (status === "active") {
          els.steps.forEach(s => {
              if (s.dataset.status === "active") s.dataset.status = "done";
          });
      }
      step.dataset.status = status;
  }
}

function parseNumber(value, label) {
  const parsed = value.trim().startsWith("0x") ? Number.parseInt(value, 16) : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid base address ${label}`);
  return parsed >>> 0;
}

function options() {
  const boot0High = els.boot0High.value;
  return {
    target: els.targetProfile.value,
    baudRate: Number.parseInt(els.baudRate.value, 10),
    timeout: Number.parseInt(els.timeoutMs.value, 10),
    parity: els.parity.value,
    flashBase: parseNumber(els.flashBase.value, "flash base"),
    packetSize: Number.parseInt(els.packetSize.value, 10),
    resetLogic: els.resetLogic.value,
    resetConfig: els.resetLogic.value === "custom"
      ? {
          boot0High,
          boot0Low: boot0High.replace("true", "TMP").replace("false", "true").replace("TMP", "false"),
          resetAssert: els.resetAssert.value,
        }
      : els.resetLogic.value,
    doErase: els.doErase.checked,
    doVerify: els.doVerify.checked,
    doRun: els.doRun.checked,
    doUnlock: els.doUnlock.checked,
  };
}

function browserBootloaderEntryStages(config) {
  const stages = bootloaderEntryStages(config.resetConfig);
  if (config.resetLogic !== "dtr-low-rts-high") return stages;

  const explicitStages = [
    makeBrowserResetStage("RTS BOOT=true / DTR RESET=false", "rts", true, "dtr", false),
    makeBrowserResetStage("RTS BOOT=true / DTR RESET=true", "rts", true, "dtr", true),
    makeBrowserResetStage("RTS BOOT=false / DTR RESET=true", "rts", false, "dtr", true),
    makeBrowserResetStage("RTS BOOT=false / DTR RESET=false", "rts", false, "dtr", false),
    makeBrowserResetStage("DTR BOOT=true / RTS RESET=true", "dtr", true, "rts", true),
    makeBrowserResetStage("DTR BOOT=true / RTS RESET=false", "dtr", true, "rts", false),
    makeBrowserResetStage("DTR BOOT=false / RTS RESET=true", "dtr", false, "rts", true),
    makeBrowserResetStage("DTR BOOT=false / RTS RESET=false", "dtr", false, "rts", false),
  ];

  return [
    ...explicitStages,
    ...stages,
  ];
}

function signalForLine(line, value) {
  return line === "dtr"
    ? { dataTerminalReady: value }
    : { requestToSend: value };
}

function combinedSignals(...choices) {
  return choices.reduce((signals, [line, value]) => ({
    ...signals,
    ...signalForLine(line, value),
  }), {});
}

function makeBrowserResetStage(name, bootLine, bootValue, resetLine, resetAssertValue) {
  const resetReleaseValue = !resetAssertValue;
  const idleBootValue = !bootValue;

  return {
    name,
    config: [
      {
        signals: combinedSignals([bootLine, idleBootValue], [resetLine, resetReleaseValue]),
        delayMs: 150,
      },
      {
        signals: combinedSignals([bootLine, bootValue], [resetLine, resetReleaseValue]),
        delayMs: 150,
      },
      {
        signals: combinedSignals([bootLine, bootValue], [resetLine, resetAssertValue]),
        delayMs: 150,
      },
      {
        signals: combinedSignals([bootLine, bootValue], [resetLine, resetReleaseValue]),
        delayMs: 1000,
      },
    ],
    runConfig: [
      {
        signals: combinedSignals([bootLine, idleBootValue], [resetLine, resetReleaseValue]),
        delayMs: 150,
      },
      {
        signals: combinedSignals([bootLine, idleBootValue], [resetLine, resetAssertValue]),
        delayMs: 150,
      },
      {
        signals: combinedSignals([bootLine, idleBootValue], [resetLine, resetReleaseValue]),
        delayMs: 1000,
      },
    ],
  };
}

async function enterBootloaderStage(transport, delay, stageConfig) {
  if (!Array.isArray(stageConfig)) {
    await enterBootloader(transport, delay, stageConfig);
    return;
  }

  for (const step of stageConfig) {
    await transport.setSignals(step.signals);
    await delay(step.delayMs);
  }
}

async function resetToRunStage(transport, delay, stageConfig, fallbackConfig) {
  if (!Array.isArray(stageConfig)) {
    await resetToRun(transport, delay, fallbackConfig);
    return;
  }

  for (const step of stageConfig) {
    await transport.setSignals(step.signals);
    await delay(step.delayMs);
  }
}

async function releaseBootForRunStage(transport, delay, stageConfig) {
  if (!Array.isArray(stageConfig) || stageConfig.length === 0) return;
  const [releaseStep] = stageConfig;
  await transport.setSignals(releaseStep.signals);
  await delay(releaseStep.delayMs);
}

async function goToAddress(bootloader, transport, address) {
  if (typeof bootloader.go === "function") {
    await bootloader.go(address);
    return;
  }

  await bootloader.sendCommand(COMMANDS.GO);
  await transport.write(addressPacket(address));
  await bootloader.expectAck();
}

async function syncBootloaderIgnoringNoise(transport, timeout) {
  const deadline = Date.now() + timeout;
  const ignored = [];
  await transport.flushReadBuffer();
  await transport.write([SYNC]);

  while (Date.now() < deadline) {
    const remaining = Math.max(1, deadline - Date.now());
    let byte;
    try {
      byte = (await transport.readExact(1, remaining))[0];
    } catch (error) {
      if (ignored.length > 0) {
        const preview = ignored.slice(0, 16).map((value) => toHex(value)).join(" ");
        const suffixText = ignored.length > 16 ? " ..." : "";
        throw new Error(`读取超时 (等待 Bootloader ACK, 已忽略 ${ignored.length} 字节非 Bootloader 响应: ${preview}${suffixText})`);
      }
      throw error;
    }
    if (byte === ACK) return ignored;
    if (byte === NACK) throw new Error("Bootloader returned NACK");
    ignored.push(byte);
  }

  const preview = ignored.slice(0, 16).map((value) => toHex(value)).join(" ");
  const suffixText = ignored.length > 16 ? " ..." : "";
  throw new Error(`读取超时 (等待 Bootloader ACK, 已忽略 ${ignored.length} 字节非 Bootloader 响应: ${preview}${suffixText})`);
}

function updateUi() {
  const supported = "serial" in navigator;
  els.supportStatus.textContent = supported ? t("serialOk") : t("serialNo");
  els.supportStatus.dataset.ok = supported ? "true" : "false";

  const btnPort = els.selectPortBtn;
  if(state.connected) {
      btnPort.dataset.connected = "true";
  } else {
      btnPort.dataset.connected = "false";
      els.portName.textContent = t("selectPort");
  }

  els.connectBtn.disabled = !supported || state.connected;
  els.disconnectBtn.disabled = !state.connected;

  const canFlash = state.connected && state.firmware && els.targetProfile.value === "stm32-uart";
  els.fullProcessBtn.disabled = !canFlash;

  // 调试面板更新
  [els.enterBootBtn, els.resetRunBtn, els.dtrLowBtn, els.dtrHighBtn, els.rtsLowBtn, els.rtsHighBtn, els.sendHexBtn, els.readByteBtn].forEach((button) => {
    if(button) button.disabled = !state.connected;
  });
}

function applySavedPreferences() {
  const savedVerify = localStorage.getItem("doVerify");
  if (savedVerify !== null) {
    els.doVerify.checked = savedVerify === "true";
  }
}

async function requestPort() {
    try {
        state.port = await navigator.serial.requestPort();
        // Try getting info if browser supports it
        const info = state.port.getInfo();
        const vid = info.usbVendorId ? toHex(info.usbVendorId, 4) : "xxxx";
        const pid = info.usbProductId ? toHex(info.usbProductId, 4) : "xxxx";
        els.portName.textContent = `USB Serial (VID:${vid} PID:${pid})`;
        await connect();
    } catch (e) {
        if (!e.message.includes('No port selected')) {
            log(`串口选择失败: ${e.message}`, "error");
        }
    }
}

async function connect() {
  if (!state.port) return;
  const config = options();

  try {
    state.transport = new SerialTransport(state.port, log);
    await state.transport.open({
        baudRate: config.baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: config.parity,
        flowControl: "none",
    });

    state.connected = true;
    const { timeout } = config;
    state.bootloader = new Stm32Bootloader(state.transport, {
        timeout,
        onProgress: ({ phase, offset, total }) => {
            const base = phase === "write" ? 35 : 70;
            const span = phase === "write" ? 35 : 25;
            setProgress(base + (offset / total) * span);
        },
    });

    log(`✅ 串口已开启: 波特率 ${config.baudRate}, 数据位 8, 检验位 ${config.parity[0].toUpperCase()}, 停止位 1`);
  } catch (e) {
      log(`串口连接失败: ${e.message}`, "error");
      state.transport = null;
      state.port = null;
  }
  updateUi();
}

async function disconnect() {
  if (state.transport) {
      await state.transport.close();
  }
  state.connected = false;
  state.port = null;
  state.transport = null;
  state.bootloader = null;
  resetSteps();
  setProgress(0);
  log("⛔ 串口已关闭。");
  updateUi();
}

// ============== 核心烧录流水线 ==============

async function runAutoProgram() {
    const config = options();
    if (!state.connected || !state.bootloader || !state.firmware) return;
    if (config.target !== "stm32-uart") {
        log("当前自动烧录流程仅实现 STM32 UART ISP。其他目标请使用调试控制台或后续协议适配器。", "warn");
        return;
    }

    // UI 锁定
    els.fullProcessBtn.disabled = true;
    setProgress(0);
    resetSteps();
    els.log.innerHTML += "<br/>========== 开始一键烧写流程 ==========\n";
    let selectedRunConfig = null;

    async function enterAndSyncBootloader() {
        const stages = browserBootloaderEntryStages(config);
        let info = null;
        let chipId = null;
        let lastError = null;
        for (const [index, stage] of stages.entries()) {
            const suffix = stages.length > 1 ? ` (${stage.name}, ${index + 1}/${stages.length})` : "";
            log(`2.${index + 1} 正在进入 Bootloader 并同步${suffix}...`);
            try {
                await enterBootloaderStage(state.transport, delay, stage.config);
                const ignored = await syncBootloaderIgnoringNoise(state.transport, config.timeout);
                if (ignored.length > 0) {
                    const preview = ignored.slice(0, 16).map((byte) => toHex(byte)).join(" ");
                    const suffixText = ignored.length > 16 ? " ..." : "";
                    log(`⚠️ 同步前忽略了 ${ignored.length} 字节非 Bootloader 响应: ${preview}${suffixText}`, "warn");
                }
                info = await state.bootloader.getCommands();
                chipId = await state.bootloader.getId();
                selectedRunConfig = stage.runConfig ?? null;
                log(`==> 同步成功${suffix}: Bootloader ${toHex(info.version)}, PID ${toHex(chipId, 4)}`);
                return { info, chipId };
            } catch (error) {
                lastError = error;
                if (index < stages.length - 1) {
                    log(`⚠️ 同步失败${suffix}: ${error.message}，尝试下一组控制线时序...`, "warn");
                    continue;
                }
                throw error;
            }
        }
        throw lastError ?? new Error("Bootloader 同步失败");
    }

    try {
        // 第一步: 端口本身我们已经打开了
        setStep("port", "done");

        // 第二步: 通过 DTR/RTS 唤起 Bootloader
        setStep("boot", "active");
        log(`1. 正在复位单片机并进入 ISP 模式 (模式: ${config.resetLogic})...`);
        setStep("boot", "done");

        // 第三步: 测试波特率 & 握手
        setStep("sync", "active");
        await enterAndSyncBootloader();
        setStep("sync", "done");

        // 第四步: 擦除
        setStep("erase", "active");
        if (config.doErase) {
            log(`3. 正在执行芯片擦除...`);
            try {
                const eraseMode = await state.bootloader.massErase();
                log(`==> Flash 擦除完成 (模式: ${eraseMode}).`);
            } catch (error) {
                if (/NACK/.test(error.message) && config.doUnlock) {
                    log(`⚠️ 检测到芯片写保护(读保护)，正在尝试暴力解除读保护...`, "warn");
                    // 发送解除读保护，单片机会自我擦除，过程将持续 2-3 秒，并硬复位
                    await state.bootloader.readoutUnprotect();
                    log(`==> 保护已解除，芯片已自我重置。需重新建立握手接管。`);

                    log(`[*] 再次进入 Bootloader 模式...`);
                    await enterAndSyncBootloader();
                    log(`[*] 二次握手同步成功！接管完成。`);
                } else {
                    throw error; // 不是NACK问题，或是没开强制解锁，直接往外抛异常终止
                }
            }
        } else {
            log(`3. (跳过擦除步骤)`);
        }
        setStep("erase", "done");
        setProgress(35);

        // 第五步: 分块写入固件 (耗时主力操作)
        setStep("write", "active");
        log(`4. 正在往起始地址 ${toHex(config.flashBase, 8)} 烧写 ${state.firmwareName}...`);
        await state.bootloader.writeMemory(config.flashBase, state.firmware, config.packetSize);
        log(`==> 烧写完成！`);
        setStep("write", "done");
        setProgress(70);

        // 第六步: 校验文件
        if (config.doVerify) {
            setStep("verify", "active");
            log(`5. 正在读回数据并与原固件交叉比对校验...`);
            await state.bootloader.verify(config.flashBase, state.firmware, config.packetSize);
            log(`==> 校验通过! 数据 100% 吻合。`);
        } else {
            log(`5. (跳过数据校验步骤)`);
        }
        setStep("verify", "done");
        setProgress(95);

        // 第七步: 复位运行
        if (config.doRun) {
            setStep("run", "active");
            log(`6. 正在释放 BOOT 条件并跳转运行用户程序...`);
            try {
                await releaseBootForRunStage(state.transport, delay, selectedRunConfig);
                await goToAddress(state.bootloader, state.transport, config.flashBase);
                log(`==> 已通过 Bootloader GO 跳转到 ${toHex(config.flashBase, 8)}，请观察板子是否正常运行。`);
            } catch (error) {
                log(`⚠️ GO 跳转失败: ${error.message}，改用硬件 RESET 脉冲...`, "warn");
                await resetToRunStage(state.transport, delay, selectedRunConfig, config.resetConfig);
                log(`==> 已发送硬件 RESET 脉冲，请观察板子是否正常运行。`);
            }
        } else {
            log(`6. (烧写完毕，程序停留在 Bootloader 等待手动复位)`);
        }
        setStep("run", "done");
        setProgress(100);

        log(`🎉 任务圆满完成！(Total Success)`, "info");

    } catch (e) {
        log(`❌ 烧写流程终止: ${e.message}`, "error");
        setStep("port", "error"); // 标记当前失败
    } finally {
        els.fullProcessBtn.disabled = false;
    }
}

// ============== 绑定事件 ==============
els.languageSelect.addEventListener("change", () => {
    state.lang = els.languageSelect.value;
    localStorage.setItem("lang", state.lang);
    applyLanguage();
});

els.targetProfile.addEventListener("change", updateUi);
els.selectPortBtn.addEventListener("click", requestPort);
els.connectBtn.addEventListener("click", connect);
els.disconnectBtn.addEventListener("click", disconnect);
els.fullProcessBtn.addEventListener("click", runAutoProgram);
els.clearLogBtn.addEventListener("click", () => els.log.innerHTML = "");
els.doVerify.addEventListener("change", () => {
    localStorage.setItem("doVerify", String(els.doVerify.checked));
});

els.firmwareInput.addEventListener("change", async () => {
  const file = els.firmwareInput.files[0];
  if (!file) return;
  state.firmwareName = file.name;

  try {
      const firmware = await loadFirmwareFile(file);
      state.firmware = firmware.bytes;
      if (firmware.baseAddress !== null) {
          els.flashBase.value = toHex(firmware.baseAddress, 8);
      }
      els.firmwareName.textContent = file.name;
      els.firmwareSize.textContent = `${firmware.format.toUpperCase()} / ${(state.firmware.length / 1024).toFixed(2)} KB`;
      log(`📄 加载固件成功: ${file.name} (${state.firmware.length} bytes, 类型: ${firmware.format.toUpperCase()}).`);
  } catch(e) {
      log(`读取固件错误: ${e.message}`, "error");
      state.firmware = null;
      els.firmwareName.textContent = t("chooseFirmware");
      els.firmwareSize.textContent = t("noFile");
  }
  updateUi();
});

// ==== 调试控制台快捷动作 ====
els.enterBootBtn.addEventListener("click", async () => {
    log(`调试指令：尝试强制按配置 ${options().resetLogic} 拉线进Boot...`);
    await enterBootloader(state.transport, delay, options().resetConfig);
    log(`尝试完成，若电路正常芯片现已进入ISP等待。`);
});
els.resetRunBtn.addEventListener("click", async () => {
    log(`调试指令：尝试强制复位跑起用户程序...`);
    await resetToRun(state.transport, delay, options().resetConfig);
    log(`已发送复位放行信号。`);
});

function parseHex(input) {
  const clean = input.replace(/0x/gi, " ").replace(/[^0-9a-fA-F]/g, " ").trim();
  if (!clean) return [];
  return clean.split(/\s+/).map((part) => {
    const value = Number.parseInt(part, 16);
    if (!Number.isFinite(value) || value < 0 || value > 255) throw new Error(`Invalid byte: ${part}`);
    return value;
  });
}

els.sendHexBtn.addEventListener("click", async () => {
    const bytes = parseHex(els.hexInput.value);
    await state.transport.write(bytes);
    log(`TX ${bytes.map((byte) => toHex(byte)).join(" ")}`);
});
els.readByteBtn.addEventListener("click", async () => {
    const byte = (await state.transport.readExact(1, options().timeout))[0];
    log(`RX ${toHex(byte)}`);
});

// Raw DTR/RTS overrides: True is 0V (Low), False is 3.3V (High)
els.dtrLowBtn.addEventListener("click", async () => { log("DTR = 0V (True)"); await state.transport.setSignals({ dataTerminalReady: true }); });
els.dtrHighBtn.addEventListener("click", async () => { log("DTR = 3.3V (False)"); await state.transport.setSignals({ dataTerminalReady: false }); });
els.rtsLowBtn.addEventListener("click", async () => { log("RTS = 0V (True)"); await state.transport.setSignals({ requestToSend: true }); });
els.rtsHighBtn.addEventListener("click", async () => { log("RTS = 3.3V (False)"); await state.transport.setSignals({ requestToSend: false }); });

window.addEventListener("beforeunload", () => {
  if (state.connected) state.transport?.close();
});

if (!("serial" in navigator)) {
  log("当前浏览器环境不支持 Web Serial（请使用新版 Edge 或 Chrome，并且必须在 HTTPS 或 localhost 环境下打开）", "warn");
}
applySavedPreferences();
applyLanguage();
