import test from "node:test";
import assert from "node:assert/strict";
import { troubleshootingHints } from "../src/vscode/error-hints.js";

test("troubleshootingHints explains bootloader sync timeouts", () => {
  const hints = troubleshootingHints(new Error("读取超时 (等待 Bootloader ACK)"), {
    resetMode: "ch340x",
  });

  assert.ok(hints.some((hint) => hint.includes("BOOT0/RESET")));
  assert.ok(hints.some((hint) => hint.includes("ch340x")));
});

test("troubleshootingHints explains busy ports and permission failures", () => {
  const hints = troubleshootingHints(new Error("Resource busy EACCES"));

  assert.ok(hints.some((hint) => hint.includes("占用串口")));
  assert.ok(hints.some((hint) => hint.includes("dialout")));
});

test("troubleshootingHints warns before read protection unlock", () => {
  const hints = troubleshootingHints(new Error("Bootloader returned NACK"));

  assert.ok(hints.some((hint) => hint.includes("读保护")));
  assert.ok(hints.some((hint) => hint.includes("全片擦除")));
});

test("troubleshootingHints explains verify address mismatches", () => {
  const hints = troubleshootingHints(new Error("Verify failed at 0x08004000"));

  assert.ok(hints.some((hint) => hint.includes("flashAddress")));
});
