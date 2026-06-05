export class SerialTransport {
  constructor(port, log = () => {}) {
    this.port = port;
    this.log = log;
    this.reader = null;
    this.writer = null;
    this.readBuffer = [];
    this._readingPromise = null;
    this._keepReading = false;
  }

  async open(options) {
    await this.port.open({ bufferSize: 8192, ...options });
    this.writer = this.port.writable.getWriter();
    // Use a background reading loop to keep buffer flowing
    this._keepReading = true;
    this._readingPromise = this._readLoop();
  }

  async _readLoop() {
    while (this.port.readable && this._keepReading) {
      this.reader = this.port.readable.getReader();
      try {
        while (true) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value) {
            this.readBuffer.push(...value);
          }
        }
      } catch (error) {
        if (this._keepReading) {
          this.log(`Serial read error: ${error.message}`);
        }
      } finally {
        this.reader.releaseLock();
      }
    }
  }

  async close() {
    this._keepReading = false;

    // Stop the reader
    try {
      if (this.reader) {
        await this.reader.cancel();
      }
    } catch (_) {}

    if (this._readingPromise) {
      await this._readingPromise.catch(() => {});
    }

    try {
      if (this.writer) {
        await this.writer.close();
        this.writer.releaseLock();
      }
    } catch (error) {
        this.log(`Writer close warning: ${error.message}`);
    }

    if (this.port?.readable || this.port?.writable) {
      await this.port.close();
    }

    this.reader = null;
    this.writer = null;
    this.readBuffer = [];
  }

  async write(bytes) {
    if (!this.writer) throw new Error("串口未打开");
    await this.writer.write(new Uint8Array(bytes));
  }

  async readExact(length, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (this.readBuffer.length < length) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new Error(`读取超时 (等待 ${length} 字节, 收到 ${this.readBuffer.length} 字节)`);
      }
      // wait a tiny bit to let the background reader push data
      await new Promise(r => setTimeout(r, 10));
    }
    return new Uint8Array(this.readBuffer.splice(0, length));
  }

  async flushReadBuffer() {
      this.readBuffer = [];
  }

  async setSignals(signals) {
    await this.port.setSignals(signals);
  }
}

function invertChoice(choice) {
  return choice.replace("true", "TMP").replace("false", "true").replace("TMP", "false");
}

function applyChoice(signals, choice) {
  const [name, rawValue] = choice.split("-");
  const value = rawValue === "true";
  if (name === "dtr") signals.dataTerminalReady = value;
  if (name === "rts") signals.requestToSend = value;
}

function signalsForChoice(choice) {
  const signals = {};
  applyChoice(signals, choice);
  return signals;
}

function isCh340xMode(modeOrConfig) {
  return modeOrConfig === "ch340x";
}

function normalizeResetConfig(modeOrConfig) {
  if (!modeOrConfig || modeOrConfig === "dtr-high-rts-low") {
    return { boot0High: "rts-true", boot0Low: "rts-false", resetAssert: "dtr-false" };
  }
  if (modeOrConfig === "dtr-low-rts-high") {
    return { boot0High: "rts-true", boot0Low: "rts-false", resetAssert: "dtr-true" };
  }
  if (isCh340xMode(modeOrConfig)) {
    return null;
  }
  if (modeOrConfig === "none") return null;
  if (typeof modeOrConfig === "object") {
    const boot0High = modeOrConfig.boot0High ?? "dtr-false";
    return {
      boot0High,
      boot0Low: modeOrConfig.boot0Low ?? invertChoice(boot0High),
      resetAssert: modeOrConfig.resetAssert ?? "rts-true",
    };
  }
  return { boot0High: "dtr-false", boot0Low: "dtr-true", resetAssert: "rts-true" };
}

export function bootloaderEntryStages(modeOrConfig) {
  if (isCh340xMode(modeOrConfig)) {
    return [
      {
        name: "CH340X 直连电路",
        config: "ch340x",
      },
    ];
  }
  return [{ name: "default", config: modeOrConfig }];
}

// STM32 进入 Bootloader 物理时序（兼容 CH340C 经典三极管和 CH340X 直连，并允许自定义映射）
export async function enterBootloader(transport, delay, modeOrConfig) {
  if (isCh340xMode(modeOrConfig)) {
    // CH340X 直连实测时序：先释放 RESET 并保持 BOOT0 运行态，再建立 BOOT 条件、脉冲 RESET。
    await transport.setSignals({ requestToSend: false, dataTerminalReady: true });
    await delay(150);

    await transport.setSignals({ requestToSend: true, dataTerminalReady: true });
    await delay(150);

    await transport.setSignals({ requestToSend: true, dataTerminalReady: false });
    await delay(150);

    await transport.setSignals({ requestToSend: true, dataTerminalReady: true });
    await delay(1000);
    return;
  }

  const config = normalizeResetConfig(modeOrConfig);
  if (!config) return;

  await transport.setSignals(signalsForChoice(config.boot0High));
  await delay(100);

  await transport.setSignals(signalsForChoice(config.resetAssert));
  await delay(100);

  await transport.setSignals(signalsForChoice(invertChoice(config.resetAssert)));
  await delay(800);
}

// 物理复位并运行用户程序
export async function resetToRun(transport, delay, modeOrConfig) {
  if (isCh340xMode(modeOrConfig)) {
    // CH340X 直连：退出 BOOT 条件后脉冲 RESET，运行用户程序。
    await transport.setSignals({ requestToSend: false, dataTerminalReady: false });
    await delay(250);

    await transport.setSignals({ requestToSend: false, dataTerminalReady: true });
    await delay(250);

    await transport.setSignals({ requestToSend: false, dataTerminalReady: false });
    await delay(1000);
    return;
  }

  const config = normalizeResetConfig(modeOrConfig);
  if (!config) return;

  await transport.setSignals(signalsForChoice(config.boot0Low));
  await delay(100);

  await transport.setSignals(signalsForChoice(config.resetAssert));
  await delay(100);

  await transport.setSignals(signalsForChoice(invertChoice(config.resetAssert)));
  await delay(200);

  await transport.setSignals({ dataTerminalReady: false, requestToSend: false });
  await delay(800);
}
