import test from "node:test";
import assert from "node:assert/strict";
import { makeSerialPortQuickPickItems, statusBarTextForSettings } from "../src/vscode/commands.js";

test("makeSerialPortQuickPickItems shows manufacturer, serial number, and USB ids", () => {
  const [item] = makeSerialPortQuickPickItems([
    {
      path: "/dev/tty.usbserial-10",
      manufacturer: "wch.cn",
      serialNumber: "A6001234",
      vendorId: "1a86",
      productId: "7523",
    },
  ], "/dev/tty.usbserial-10");

  assert.equal(item.label, "/dev/tty.usbserial-10");
  assert.equal(item.description, "last used");
  assert.equal(item.detail, "wch.cn / SN A6001234 / VID 1a86 / PID 7523");
});

test("statusBarTextForSettings shows remembered port when configured", () => {
  assert.equal(statusBarTextForSettings({ port: "/dev/tty.usbserial-10" }), "SerialFlash: /dev/tty.usbserial-10");
  assert.equal(statusBarTextForSettings({ port: "" }), "SerialFlash");
});
