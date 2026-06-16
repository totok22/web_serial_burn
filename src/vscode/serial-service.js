import { NodeSerialTransport } from "../node-serial-transport.js";

export async function loadSerialPort() {
  try {
    return await import("serialport");
  } catch (_) {
    throw new Error("VS Code extension requires optional dependency 'serialport'. Run npm install.");
  }
}

export function normalizePortInfo(port) {
  const path = port.path || port.comName || port.serialNumber || "";
  const product = port.manufacturer || port.friendlyName || port.vendorId || "Serial";
  return {
    path,
    label: `${path}${product ? `  ${product}` : ""}`,
    manufacturer: port.manufacturer || "",
    serialNumber: port.serialNumber || "",
    vendorId: port.vendorId || "",
    productId: port.productId || "",
  };
}

export async function listSerialPorts() {
  const { SerialPort } = await loadSerialPort();
  const ports = await SerialPort.list();
  return ports.map(normalizePortInfo).filter((port) => port.path);
}

export async function createSerialTransport(portPath, { baudRate = 115200, parity = "even", log = () => {} } = {}) {
  const { SerialPort } = await loadSerialPort();
  const port = new SerialPort({
    path: portPath,
    baudRate,
    dataBits: 8,
    stopBits: 1,
    parity,
    autoOpen: false,
  });
  return new NodeSerialTransport(port, log);
}
