export const ACK = 0x79;
export const NACK = 0x1f;
export const SYNC = 0x7f;

export const COMMANDS = {
  GET: 0x00,
  GET_ID: 0x02,
  READ_MEMORY: 0x11,
  GO: 0x21,
  WRITE_MEMORY: 0x31,
  ERASE: 0x43,
  EXTENDED_ERASE: 0x44,
  READOUT_UNPROTECT: 0x92,
};

export function xor(bytes) {
  return bytes.reduce((sum, byte) => sum ^ byte, 0);
}

export function commandPacket(command) {
  return [command, command ^ 0xff];
}

export function addressPacket(address) {
  const bytes = [
    (address >>> 24) & 0xff,
    (address >>> 16) & 0xff,
    (address >>> 8) & 0xff,
    address & 0xff,
  ];
  return [...bytes, xor(bytes)];
}

export function writePacket(chunk) {
  if (chunk.length < 1 || chunk.length > 256) {
    throw new Error("Write packet must contain 1-256 bytes");
  }
  const body = [chunk.length - 1, ...chunk];
  return [...body, xor(body)];
}

export function readLengthPacket(length) {
  if (length < 1 || length > 256) {
    throw new Error("Read length must be 1-256 bytes");
  }
  const value = length - 1;
  return [value, value ^ 0xff];
}

export function padForWrite(bytes) {
  const out = Array.from(bytes);
  while (out.length % 4 !== 0) out.push(0xff);
  return new Uint8Array(out);
}

export function toHex(value, width = 2) {
  return `0x${value.toString(16).toUpperCase().padStart(width, "0")}`;
}

export class Stm32Bootloader {
  constructor(transport, { timeout = 2000, onProgress = () => {} } = {}) {
    this.transport = transport;
    this.timeout = timeout;
    this.onProgress = onProgress;
    this.supportedCommands = new Set();
  }

  async sync() {
    await this.transport.write([SYNC]);
    await this.expectAck(1000);
  }

  async getCommands() {
    await this.sendCommand(COMMANDS.GET);
    const countMinusOne = (await this.transport.readExact(1, this.timeout))[0];
    const payload = await this.transport.readExact(countMinusOne + 1, this.timeout);
    await this.expectAck();
    const version = payload[0];
    const commands = payload.slice(1);
    this.supportedCommands = new Set(commands);
    return { version, commands };
  }

  async getId() {
    await this.sendCommand(COMMANDS.GET_ID);
    const countMinusOne = (await this.transport.readExact(1, this.timeout))[0];
    const bytes = await this.transport.readExact(countMinusOne + 1, this.timeout);
    await this.expectAck();
    return bytes.reduce((value, byte) => (value << 8) | byte, 0);
  }

  async massErase() {
    if (this.supportedCommands.has(COMMANDS.EXTENDED_ERASE)) {
      await this.sendCommand(COMMANDS.EXTENDED_ERASE);
      await this.transport.write([0xff, 0xff, 0x00]);
      await this.expectAck(15000);
      return "extended";
    }

    await this.sendCommand(COMMANDS.ERASE);
    await this.transport.write([0xff, 0x00]);
    await this.expectAck(15000);
    return "legacy";
  }

  async readoutUnprotect() {
    await this.sendCommand(COMMANDS.READOUT_UNPROTECT);
    await this.expectAck();
    await this.expectAck(15000);
  }

  async writeMemory(address, bytes, packetSize = 256) {
    let offset = 0;
    while (offset < bytes.length) {
      const rawChunk = bytes.slice(offset, offset + packetSize);
      const chunk = padForWrite(rawChunk);
      await this.sendCommand(COMMANDS.WRITE_MEMORY);
      await this.transport.write(addressPacket(address + offset));
      await this.expectAck();
      await this.transport.write(writePacket(chunk));
      await this.expectAck();
      offset += rawChunk.length;
      this.onProgress({ phase: "write", offset, total: bytes.length });
    }
  }

  async readMemory(address, length, packetSize = 256) {
    const result = new Uint8Array(length);
    let offset = 0;
    while (offset < length) {
      const size = Math.min(packetSize, length - offset);
      await this.sendCommand(COMMANDS.READ_MEMORY);
      await this.transport.write(addressPacket(address + offset));
      await this.expectAck();
      await this.transport.write(readLengthPacket(size));
      await this.expectAck();
      result.set(await this.transport.readExact(size, this.timeout), offset);
      offset += size;
      this.onProgress({ phase: "verify", offset, total: length });
    }
    return result;
  }

  async verify(address, expected, packetSize = 256) {
    const actual = await this.readMemory(address, expected.length, packetSize);
    for (let i = 0; i < expected.length; i += 1) {
      if (actual[i] !== expected[i]) {
        throw new Error(`Verify failed at ${toHex(address + i, 8)}: expected ${toHex(expected[i])}, got ${toHex(actual[i])}`);
      }
    }
  }

  async sendCommand(command) {
    await this.transport.write(commandPacket(command));
    await this.expectAck();
  }

  async expectAck(timeout = this.timeout) {
    const byte = (await this.transport.readExact(1, timeout))[0];
    if (byte === ACK) return;
    if (byte === NACK) throw new Error("Bootloader returned NACK");
    throw new Error(`Unexpected response ${toHex(byte)}`);
  }
}
