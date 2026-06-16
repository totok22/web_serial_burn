import test from "node:test";
import assert from "node:assert/strict";
import { flashStm32Uart, syncBootloaderIgnoringNoise } from "../src/core/flash-session.js";
import { ACK } from "../src/stm32.js";

class MockTransport {
  constructor(reads) {
    this.reads = reads.map((bytes) => Array.from(bytes));
    this.writes = [];
    this.signals = [];
    this.opened = false;
    this.closed = false;
  }

  async open() {
    this.opened = true;
  }

  async close() {
    this.closed = true;
  }

  async write(bytes) {
    this.writes.push(Array.from(bytes));
  }

  async readExact(length) {
    const next = this.reads.shift();
    assert.ok(next, `missing mock read of ${length} bytes`);
    assert.equal(next.length, length);
    return new Uint8Array(next);
  }

  async flushReadBuffer() {}

  async setSignals(signals) {
    this.signals.push(signals);
  }
}

test("flashStm32Uart opens, writes, verifies, runs, and closes transport", async () => {
  const reads = [
    [ACK], // sync
    [ACK], // GET command ACK
    [0x07],
    [0x31, 0x00, 0x02, 0x11, 0x21, 0x31, 0x43, 0x44],
    [ACK],
    [ACK], // GET_ID command ACK
    [0x01],
    [0x04, 0x13],
    [ACK],
    [ACK], // EXTENDED_ERASE command ACK
    [ACK], // extended erase ACK
    [ACK], // WRITE_MEMORY command ACK
    [ACK], // write address ACK
    [ACK], // write data ACK
    [ACK], // READ_MEMORY command ACK
    [ACK], // read address ACK
    [ACK], // read length ACK
    [0xaa, 0xbb], // verify payload
  ];
  const transport = new MockTransport(reads);
  const logs = [];
  const progress = [];

  await flashStm32Uart({
    transport,
    firmware: { bytes: new Uint8Array([0xaa, 0xbb]), format: "bin", baseAddress: null },
    address: 0x08000000,
    resetMode: "none",
    packetSize: 2,
    onLog: (message) => logs.push(message),
    onProgress: (event) => progress.push(event),
  });

  assert.equal(transport.opened, true);
  assert.equal(transport.closed, true);
  assert.deepEqual(transport.writes[0], [0x7f]);
  assert.ok(transport.writes.some((bytes) => bytes[0] === 0x31));
  assert.ok(transport.writes.some((bytes) => bytes[0] === 0x11));
  assert.ok(logs.includes("Done"));
  assert.equal(progress.at(-1).phase, "verify");
  assert.equal(progress.at(-1).percent, 100);
});

test("flashStm32Uart can leave transport open after successful flash", async () => {
  const reads = [
    [ACK],
    [ACK],
    [0x07],
    [0x31, 0x00, 0x02, 0x11, 0x21, 0x31, 0x43, 0x44],
    [ACK],
    [ACK],
    [0x01],
    [0x04, 0x13],
    [ACK],
    [ACK],
    [ACK],
  ];
  const transport = new MockTransport(reads);

  await flashStm32Uart({
    transport,
    firmware: { bytes: new Uint8Array([]), format: "bin", baseAddress: null },
    address: 0x08000000,
    resetMode: "none",
    erase: true,
    verify: false,
    run: false,
    close: false,
  });

  assert.equal(transport.closed, false);
});

test("flashStm32Uart closes transport on failure even when close is false", async () => {
  const transport = new MockTransport([[0x00]]);

  await assert.rejects(
    () => flashStm32Uart({
      transport,
      firmware: { bytes: new Uint8Array([0xaa]), format: "bin", baseAddress: null },
      address: 0x08000000,
      resetMode: "none",
      close: false,
    }),
    /已忽略 1 字节非 Bootloader 响应: 0x00/,
  );

  assert.equal(transport.closed, true);
});

test("syncBootloaderIgnoringNoise ignores non bootloader bytes before ACK", async () => {
  const transport = new MockTransport([[0x43], [0x00], [ACK]]);

  const ignored = await syncBootloaderIgnoringNoise(transport, 1000);

  assert.deepEqual(ignored, [0x43, 0x00]);
  assert.deepEqual(transport.writes, [[0x7f]]);
});

test("syncBootloaderIgnoringNoise reports ignored bytes on timeout", async () => {
  const transport = new MockTransport([[0x43]]);

  await assert.rejects(
    () => syncBootloaderIgnoringNoise(transport, 1000),
    /已忽略 1 字节非 Bootloader 响应: 0x43/,
  );
});
