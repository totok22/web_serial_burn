import { Stm32Bootloader, toHex } from "./stm32.js";
import { SerialTransport, enterBootloader, resetToRun } from "./serial-transport.js";
import { loadFirmwareFile } from "./firmware.js";

const $ = (id) => document.getElementById(id);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const i18n = {
  zh: {
    eyebrow: "Web Serial / STM32 UART ISP",
    appTitle: "Web FlyMcu",
    selectPort: "请选择串口",
    chooseFirmware: "点击选择固件文件 (.bin)",
    noFile: "未加载文件",
    resetMode1: "DTR的高电平复位，RTS低电平进BootLoader (推荐/CH340X)",
    resetMode2: "DTR的低电平复位，RTS高电平进BootLoader",
    resetModeNone: "不使用控制线 (手动按键进Boot)",
    doErase: "烧录前全片擦除",
    doVerify: "烧录后校验数据",
    doRun: "烧录成功后复位并运行程序",
    doUnlock: "若发生读保护，自动解除保护 (将擦除全片)",
    startProgram: "开始编程",
    openPort: "开启串口",
    closePort: "关闭串口",
    clear: "清空日志",
    stepPort: "打开串口连接",
    stepBoot: "进入 Bootloader 模式",
    stepSync: "握手同步并读取芯片信息",
    stepErase: "擦除芯片 Flash",
    stepWrite: "分块写入固件数据",
    stepVerify: "读回固件进行一致性校验",
    stepRun: "复位并启动用户程序",
    serialOk: "Web Serial API (就绪)",
    serialNo: "Web Serial 浏览器不支持该特性",
  },
  en: {
    eyebrow: "Web Serial / STM32 UART ISP",
    appTitle: "Web FlyMcu",
    selectPort: "Select Serial Port",
    chooseFirmware: "Click to select firmware (.bin)",
    noFile: "No file loaded",
    resetMode1: "DTR high reset, RTS low bootloader (CH340X)",
    resetMode2: "DTR low reset, RTS high bootloader",
    resetModeNone: "No control flow (Manual boot)",
    doErase: "Mass erase before writing",
    doVerify: "Verify data after writing",
    doRun: "Reset and run program upon success",
    doUnlock: "Auto-unlock readout protection (erases chip)",
    startProgram: "Start Programming",
    openPort: "Open Port",
    closePort: "Close Port",
    clear: "Clear Log",
    stepPort: "Open serial port connection",
    stepBoot: "Enter Bootloader mode",
    stepSync: "Handshake sync and read chip info",
    stepErase: "Erase Flash memory",
    stepWrite: "Write firmware data blocks",
    stepVerify: "Verify written data consistency",
    stepRun: "Reset and start user program",
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
  baudRate: $("baudRate"),
  resetLogic: $("resetLogic"),
  flashBase: $("flashBase"),
  packetSize: $("packetSize"),
  parity: $("parity"),
  timeoutMs: $("timeoutMs"),
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
  return {
    baudRate: Number.parseInt(els.baudRate.value, 10),
    timeout: Number.parseInt(els.timeoutMs.value, 10),
    parity: els.parity.value,
    flashBase: parseNumber(els.flashBase.value, "flash base"),
    packetSize: Number.parseInt(els.packetSize.value, 10),
    resetLogic: els.resetLogic.value,
    doErase: els.doErase.checked,
    doVerify: els.doVerify.checked,
    doRun: els.doRun.checked,
    doUnlock: els.doUnlock.checked,
  };
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

  const canFlash = state.connected && state.firmware;
  els.fullProcessBtn.disabled = !canFlash;

  // 调试面板更新
  [els.enterBootBtn, els.resetRunBtn, els.dtrLowBtn, els.dtrHighBtn, els.rtsLowBtn, els.rtsHighBtn, els.sendHexBtn, els.readByteBtn].forEach((button) => {
    if(button) button.disabled = !state.connected;
  });
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

// ============== 核心烧录流水线 (FlyMCU Logic) ==============

async function runAutoProgram() {
    const config = options();
    if (!state.connected || !state.bootloader || !state.firmware) return;

    // UI 锁定
    els.fullProcessBtn.disabled = true;
    setProgress(0);
    resetSteps();
    els.log.innerHTML += "<br/>========== 开始一键烧写流程 ==========\n";

    try {
        // 第一步: 端口本身我们已经打开了
        setStep("port", "done");

        // 第二步: 通过 DTR/RTS 唤起 Bootloader
        setStep("boot", "active");
        log(`1. 正在复位单片机并进入 ISP 模式 (模式: ${config.resetLogic})...`);
        await enterBootloader(state.transport, delay, config.resetLogic);
        setStep("boot", "done");

        // 第三步: 并行测试波特率 & 握手
        setStep("sync", "active");
        log(`2. 正在进行底层波特率检测与同步协商(Sync)...`);

        // 这一步清空一下可能杂乱的串口读缓冲
        await state.transport.flushReadBuffer();

        await state.bootloader.sync();
        const info = await state.bootloader.getCommands();
        const chipId = await state.bootloader.getId();
        log(`==> 芯片同步成功!`);
        log(`==> Bootloader 版本: ${toHex(info.version)}, PID: ${toHex(chipId, 4)}`);
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
                    await enterBootloader(state.transport, delay, config.resetLogic);
                    await state.transport.flushReadBuffer();
                    await state.bootloader.sync();
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
            log(`6. 正在拉低 RESET 脚，复位并自动启动用户程序程序...`);
            await resetToRun(state.transport, delay, config.resetLogic);
            log(`==> 操作完毕！请观察板子是否正常运行。`);
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

els.selectPortBtn.addEventListener("click", requestPort);
els.connectBtn.addEventListener("click", connect);
els.disconnectBtn.addEventListener("click", disconnect);
els.fullProcessBtn.addEventListener("click", runAutoProgram);
els.clearLogBtn.addEventListener("click", () => els.log.innerHTML = "");

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
    await enterBootloader(state.transport, delay, options().resetLogic);
    log(`尝试完成，若电路正常芯片现已进入ISP等待。`);
});
els.resetRunBtn.addEventListener("click", async () => {
    log(`调试指令：尝试强制复位跑起用户程序...`);
    await resetToRun(state.transport, delay, options().resetLogic);
    log(`已发送复位放行信号。`);
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
applyLanguage();