export class SerialTransport {
  constructor(port, log = () => {}) {
    this.port = port;
    this.log = log;
    this.reader = null;
    this.writer = null;
    this.readBuffer = [];
  }

  async open(options) {
    await this.port.open(options);
    this.writer = this.port.writable.getWriter();
    this.reader = this.port.readable.getReader();
  }

  async close() {
    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader.releaseLock();
      }
    } catch (error) {
      this.log(`Reader close warning: ${error.message}`);
    }
    try {
      if (this.writer) {
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
    if (!this.writer) throw new Error("Serial writer is not open");
    await this.writer.write(new Uint8Array(bytes));
  }

  async readExact(length, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (this.readBuffer.length < length) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new Error(`Read timeout after ${timeoutMs} ms`);
      }
      const read = this.reader.read();
      const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Read timeout after ${timeoutMs} ms`)), remaining);
      });
      const { value, done } = await Promise.race([read, timeout]);
      if (done) throw new Error("Serial stream closed");
      this.readBuffer.push(...value);
    }
    return new Uint8Array(this.readBuffer.splice(0, length));
  }

  async setSignals(signals) {
    await this.port.setSignals(signals);
  }
}

function applyChoice(signals, choice) {
  const [name, rawValue] = choice.split("-");
  const value = rawValue === "true";
  if (name === "dtr") signals.dataTerminalReady = value;
  if (name === "rts") signals.requestToSend = value;
}

export async function enterBootloader(transport, delay, config = {}) {
  const boot0High = config.boot0High ?? "dtr-false";
  const resetAssert = config.resetAssert ?? "rts-true";
  const hold = { dataTerminalReady: false, requestToSend: false };
  applyChoice(hold, boot0High);
  applyChoice(hold, resetAssert);
  await transport.setSignals(hold);
  await delay(120);
  const release = { dataTerminalReady: false, requestToSend: false };
  applyChoice(release, boot0High);
  await transport.setSignals(release);
  await delay(80);
}

export async function resetToRun(transport, delay, config = {}) {
  const boot0Low = config.boot0Low ?? "dtr-true";
  const resetAssert = config.resetAssert ?? "rts-true";
  const hold = { dataTerminalReady: false, requestToSend: false };
  applyChoice(hold, boot0Low);
  applyChoice(hold, resetAssert);
  await transport.setSignals(hold);
  await delay(120);
  const releaseReset = { dataTerminalReady: false, requestToSend: false };
  applyChoice(releaseReset, boot0Low);
  await transport.setSignals(releaseReset);
  await delay(80);
  await transport.setSignals({ dataTerminalReady: false, requestToSend: false });
}
