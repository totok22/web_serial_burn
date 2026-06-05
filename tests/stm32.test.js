import test from "node:test";
import assert from "node:assert/strict";
import { addressPacket, commandPacket, padForWrite, Stm32Bootloader, writePacket } from "../src/stm32.js";

test("commandPacket appends inverted command byte", () => {
  assert.deepEqual(commandPacket(0x31), [0x31, 0xce]);
});

test("addressPacket appends XOR checksum", () => {
  assert.deepEqual(addressPacket(0x08000000), [0x08, 0x00, 0x00, 0x00, 0x08]);
});

test("writePacket encodes length minus one and XOR checksum", () => {
  assert.deepEqual(writePacket([0x01, 0x02, 0x03, 0x04]), [0x03, 0x01, 0x02, 0x03, 0x04, 0x07]);
});

test("padForWrite pads writes to 4-byte flash alignment", () => {
  assert.deepEqual(Array.from(padForWrite(new Uint8Array([1, 2, 3]))), [1, 2, 3, 0xff]);
});

test("getCommands reads payload before final ACK", async () => {
  const writes = [];
  const reads = [
    [0x79],
    [0x0b],
    [0x22, 0x00, 0x01, 0x02, 0x11, 0x21, 0x31, 0x43, 0x63, 0x73, 0x82, 0x92],
    [0x79],
  ];
  const transport = {
    write: async (bytes) => writes.push(Array.from(bytes)),
    readExact: async (length) => {
      const next = reads.shift();
      assert.equal(next.length, length);
      return new Uint8Array(next);
    },
  };

  const bootloader = new Stm32Bootloader(transport);
  const info = await bootloader.getCommands();

  assert.deepEqual(writes, [[0x00, 0xff]]);
  assert.equal(info.version, 0x22);
  assert.deepEqual(Array.from(info.commands), [0x00, 0x01, 0x02, 0x11, 0x21, 0x31, 0x43, 0x63, 0x73, 0x82, 0x92]);
});

test("go sends command and address packet", async () => {
  const writes = [];
  const reads = [[0x79], [0x79]];
  const transport = {
    write: async (bytes) => writes.push(Array.from(bytes)),
    readExact: async (length) => {
      const next = reads.shift();
      assert.equal(next.length, length);
      return new Uint8Array(next);
    },
  };

  const bootloader = new Stm32Bootloader(transport);
  await bootloader.go(0x08000000);

  assert.deepEqual(writes, [
    [0x21, 0xde],
    [0x08, 0x00, 0x00, 0x00, 0x08],
  ]);
});
