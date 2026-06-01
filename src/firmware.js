function parseHexByte(text, offset) {
  const pair = text.slice(offset, offset + 2);
  if (!/^[0-9a-fA-F]{2}$/.test(pair)) throw new Error(`Invalid HEX byte at ${offset}`);
  const value = Number.parseInt(pair, 16);
  if (!Number.isFinite(value)) throw new Error(`Invalid HEX byte at ${offset}`);
  return value;
}

function checksumOk(bytes, checksum) {
  const sum = bytes.reduce((acc, byte) => (acc + byte) & 0xff, 0);
  return ((sum + checksum) & 0xff) === 0;
}

export function parseIntelHex(text) {
  const segments = new Map();
  let upper = 0;
  let minAddress = Number.POSITIVE_INFINITY;
  let maxAddress = 0;
  let eof = false;

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    if (eof) throw new Error(`HEX data found after EOF at line ${index + 1}`);
    if (!line.startsWith(":")) throw new Error(`HEX line ${index + 1} does not start with ':'`);

    const count = parseHexByte(line, 1);
    const expectedLength = 11 + count * 2;
    if (line.length !== expectedLength) {
      throw new Error(`HEX line ${index + 1} has invalid length`);
    }
    if (!/^[0-9a-fA-F]{4}$/.test(line.slice(3, 7))) {
      throw new Error(`Invalid HEX address at line ${index + 1}`);
    }
    const address = Number.parseInt(line.slice(3, 7), 16);
    const type = parseHexByte(line, 7);
    const data = [];
    for (let i = 0; i < count; i += 1) data.push(parseHexByte(line, 9 + i * 2));
    const checksum = parseHexByte(line, 9 + count * 2);
    if (!checksumOk([count, (address >> 8) & 0xff, address & 0xff, type, ...data], checksum)) {
      throw new Error(`HEX checksum failed at line ${index + 1}`);
    }

    if (type === 0x00) {
      const absolute = upper + address;
      data.forEach((byte, offset) => segments.set(absolute + offset, byte));
      minAddress = Math.min(minAddress, absolute);
      maxAddress = Math.max(maxAddress, absolute + data.length);
    } else if (type === 0x01) {
      if (count !== 0) throw new Error(`HEX EOF line ${index + 1} must not contain data`);
      eof = true;
    } else if (type === 0x04) {
      if (count !== 2) throw new Error(`HEX extended linear address line ${index + 1} must contain 2 bytes`);
      upper = ((data[0] << 8) | data[1]) << 16;
    } else if (type === 0x02) {
      if (count !== 2) throw new Error(`HEX extended segment address line ${index + 1} must contain 2 bytes`);
      upper = ((data[0] << 8) | data[1]) << 4;
    } else if (type === 0x03 || type === 0x05) {
      // Start address records do not affect the flash image payload.
    } else {
      throw new Error(`Unsupported HEX record type ${type} at line ${index + 1}`);
    }
  });

  if (!eof) throw new Error("HEX file is missing EOF record");
  if (!Number.isFinite(minAddress)) throw new Error("HEX file contains no data records");
  const bytes = new Uint8Array(maxAddress - minAddress).fill(0xff);
  segments.forEach((byte, address) => {
    bytes[address - minAddress] = byte;
  });
  return { bytes, baseAddress: minAddress };
}

export async function loadFirmwareFile(file) {
  if (file.name.toLowerCase().endsWith(".hex")) {
    const parsed = parseIntelHex(await file.text());
    return { ...parsed, format: "hex" };
  }
  return { bytes: new Uint8Array(await file.arrayBuffer()), baseAddress: null, format: "bin" };
}
