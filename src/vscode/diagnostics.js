import { arch, platform, release } from "node:os";
import { loadSerialPort, listSerialPorts } from "./serial-service.js";

export async function collectDiagnostics(vscode) {
  const diagnostics = {
    extensionHost: {
      platform: platform(),
      arch: arch(),
      release: release(),
      remoteName: vscode.env?.remoteName || "local",
      uiKind: vscode.env?.uiKind ?? "unknown",
    },
    serialport: {
      loaded: false,
      version: "unknown",
      error: "",
    },
    ports: [],
  };

  try {
    const serialport = await loadSerialPort();
    diagnostics.serialport.loaded = true;
    diagnostics.serialport.version = serialport.SerialPort?.version || "available";
    diagnostics.ports = await listSerialPorts();
  } catch (error) {
    diagnostics.serialport.error = error.message;
  }

  return diagnostics;
}

export function formatDiagnostics(diagnostics) {
  const lines = [
    "SerialFlash diagnostics",
    `Host: ${diagnostics.extensionHost.remoteName}`,
    `OS: ${diagnostics.extensionHost.platform} ${diagnostics.extensionHost.release} ${diagnostics.extensionHost.arch}`,
    `VS Code UI kind: ${diagnostics.extensionHost.uiKind}`,
    `serialport: ${diagnostics.serialport.loaded ? `loaded (${diagnostics.serialport.version})` : `failed (${diagnostics.serialport.error})`}`,
    `Ports: ${diagnostics.ports.length}`,
  ];

  for (const port of diagnostics.ports) {
    const ids = [port.vendorId, port.productId].filter(Boolean).join(":");
    const detail = [
      port.manufacturer,
      port.serialNumber && `SN ${port.serialNumber}`,
      ids,
    ].filter(Boolean).join(" ");
    lines.push(`- ${port.path}${detail ? ` ${detail}` : ""}`);
  }

  if (diagnostics.extensionHost.remoteName !== "local") {
    lines.push("Note: serial ports are resolved on the Extension Host machine, not necessarily the computer running the VS Code UI.");
  }

  return lines;
}
