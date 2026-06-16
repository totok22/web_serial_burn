import test from "node:test";
import assert from "node:assert/strict";
import { normalizePortInfo } from "../src/vscode/serial-service.js";

test("normalizePortInfo preserves manufacturer, serial number, and USB ids", () => {
  assert.deepEqual(normalizePortInfo({
    path: "/dev/tty.usbserial-10",
    manufacturer: "wch.cn",
    serialNumber: "A6001234",
    vendorId: "1a86",
    productId: "7523",
  }), {
    path: "/dev/tty.usbserial-10",
    label: "/dev/tty.usbserial-10  wch.cn",
    manufacturer: "wch.cn",
    serialNumber: "A6001234",
    vendorId: "1a86",
    productId: "7523",
  });
});

test("normalizePortInfo falls back to legacy comName", () => {
  assert.equal(normalizePortInfo({ comName: "COM3", friendlyName: "USB-SERIAL CH340" }).path, "COM3");
});
