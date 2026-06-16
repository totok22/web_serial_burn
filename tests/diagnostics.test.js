import test from "node:test";
import assert from "node:assert/strict";
import { formatDiagnostics } from "../src/vscode/diagnostics.js";

function diagnostics(overrides = {}) {
  return {
    extensionHost: {
      platform: "darwin",
      arch: "arm64",
      release: "25.5.0",
      remoteName: "local",
      uiKind: 1,
      ...overrides.extensionHost,
    },
    serialport: {
      loaded: true,
      version: "available",
      error: "",
      ...overrides.serialport,
    },
    ports: overrides.ports ?? [
      {
        path: "/dev/tty.usbserial-10",
        manufacturer: "wch.cn",
        serialNumber: "A6001234",
        vendorId: "1a86",
        productId: "7523",
      },
    ],
  };
}

test("formatDiagnostics reports local host and discovered ports", () => {
  const lines = formatDiagnostics(diagnostics());

  assert.deepEqual(lines, [
    "SerialFlash diagnostics",
    "Host: local",
    "OS: darwin 25.5.0 arm64",
    "VS Code UI kind: 1",
    "serialport: loaded (available)",
    "Ports: 1",
    "- /dev/tty.usbserial-10 wch.cn SN A6001234 1a86:7523",
  ]);
});

test("formatDiagnostics explains remote extension hosts", () => {
  const lines = formatDiagnostics(diagnostics({
    extensionHost: { remoteName: "ssh-remote" },
    serialport: { loaded: false, error: "load failed" },
    ports: [],
  }));

  assert.equal(lines.includes("serialport: failed (load failed)"), true);
  assert.equal(lines.includes("Ports: 0"), true);
  assert.equal(
    lines.at(-1),
    "Note: serial ports are resolved on the Extension Host machine, not necessarily the computer running the VS Code UI.",
  );
});
