import test from "node:test";
import assert from "node:assert/strict";
import { parseIntelHex } from "../src/firmware.js";

test("parseIntelHex loads extended linear address data", () => {
  const hex = [
    ":020000040800F2",
    ":0400000001020304F2",
    ":00000001FF",
  ].join("\n");

  const parsed = parseIntelHex(hex);

  assert.equal(parsed.baseAddress, 0x08000000);
  assert.deepEqual(Array.from(parsed.bytes), [1, 2, 3, 4]);
});

test("parseIntelHex fills gaps with 0xff", () => {
  const hex = [
    ":020000040800F2",
    ":01000000AA55",
    ":01000400BB40",
    ":00000001FF",
  ].join("\n");

  const parsed = parseIntelHex(hex);

  assert.deepEqual(Array.from(parsed.bytes), [0xaa, 0xff, 0xff, 0xff, 0xbb]);
});

test("parseIntelHex rejects malformed bytes", () => {
  assert.throws(
    () => parseIntelHex(":010000000GFF\n:00000001FF"),
    /Invalid HEX byte/,
  );
});

test("parseIntelHex rejects malformed addresses", () => {
  assert.throws(
    () => parseIntelHex(":01000G00AA4F\n:00000001FF"),
    /Invalid HEX address/,
  );
});

test("parseIntelHex requires EOF", () => {
  assert.throws(
    () => parseIntelHex(":01000000AA55"),
    /missing EOF/,
  );
});
