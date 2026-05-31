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

function normalizeResetConfig(modeOrConfig) {
  if (!modeOrConfig || modeOrConfig === "dtr-high-rts-low") {
    return { boot0High: "dtr-false", boot0Low: "dtr-true", resetAssert: "rts-true" };
  }
  if (modeOrConfig === "dtr-low-rts-high") {
    return { boot0High: "dtr-true", boot0Low: "dtr-false", resetAssert: "rts-true" };
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

// STM32 进入 Bootloader 物理时序（兼容 CH340C 经典三极管和 CH340X 直连，并允许自定义映射）
export async function enterBootloader(transport, delay, modeOrConfig) {
  const config = normalizeResetConfig(modeOrConfig);
  if (!config) return;

  const hold = { dataTerminalReady: false, requestToSend: false };
  applyChoice(hold, config.boot0High);
  applyChoice(hold, config.resetAssert);
  await transport.setSignals(hold);
  await delay(120);

  const releaseReset = { dataTerminalReady: false, requestToSend: false };
  applyChoice(releaseReset, config.boot0High);
  await transport.setSignals(releaseReset);
  await delay(80);
}

// 物理复位并运行用户程序
export async function resetToRun(transport, delay, modeOrConfig) {
  const config = normalizeResetConfig(modeOrConfig);
  if (!config) return;

  const hold = { dataTerminalReady: false, requestToSend: false };
  applyChoice(hold, config.boot0Low);
  applyChoice(hold, config.resetAssert);
  await transport.setSignals(hold);
  await delay(120);

  const releaseReset = { dataTerminalReady: false, requestToSend: false };
  applyChoice(releaseReset, config.boot0Low);
  await transport.setSignals(releaseReset);
  await delay(80);

  await transport.setSignals({ dataTerminalReady: false, requestToSend: false });
}
