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

// STM32 进入 Bootloader 物理时序（兼容 CH340N/C 经典三极管 和 CH340X 直连）
export async function enterBootloader(transport, delay, mode) {
    if (mode === "none") return;

    // true 表示软件上的低电平（物理0V），false 表示软件高电平（物理3.3V）
    if (mode === "dtr-high-rts-low") {
        // 第一步：BOOT0拔高(DTR=False)，压死复位(RTS=True)
        await transport.setSignals({ dataTerminalReady: false, requestToSend: true });
        await delay(100);
        // 第二步：释放复位(RTS=False)，此时BOOT0依然保持高电平以进入SystemMemory
        await transport.setSignals({ dataTerminalReady: false, requestToSend: false });
        await delay(50);
    }
    else if (mode === "dtr-low-rts-high") {
        await transport.setSignals({ dataTerminalReady: true, requestToSend: false });
        await delay(100);
        await transport.setSignals({ dataTerminalReady: false, requestToSend: false });
        await delay(50);
    }
}

// 物理复位并运行用户程序
export async function resetToRun(transport, delay, mode) {
    if (mode === "none") return;

    if (mode === "dtr-high-rts-low") {
        // 第一步：BOOT0拉低(DTR=True)，压死复位(RTS=True)
        await transport.setSignals({ dataTerminalReady: true, requestToSend: true });
        await delay(100);
        // 第二步：彻底释放，程序起跑
        await transport.setSignals({ dataTerminalReady: false, requestToSend: false });
        await delay(50);
    }
    else if (mode === "dtr-low-rts-high") {
        await transport.setSignals({ dataTerminalReady: false, requestToSend: true });
        await delay(100);
        await transport.setSignals({ dataTerminalReady: false, requestToSend: false });
        await delay(50);
    }
}