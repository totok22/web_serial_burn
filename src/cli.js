#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { loadFirmwarePath } from "./node-firmware.js";
import { NodeSerialTransport } from "./node-serial-transport.js";
import { Stm32Bootloader, toHex } from "./stm32.js";
import { bootloaderEntryStages, enterBootloader, resetToRun } from "./serial-transport.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function usage() {
  return `Usage:
  web-mcu-burn --port <path> --file <firmware.bin|firmware.hex> [options]

Options:
  --baud <rate>          Baud rate, default 115200
  --address <hex|dec>    Override flash base address
  --packet <bytes>       Write packet size, default 256
  --timeout <ms>         Read timeout, default 2000
  --parity <mode>        even|none, default even
  --reset <mode>         dtr-high-rts-low|dtr-low-rts-high|ch340x|none
  --no-erase             Skip mass erase
  --no-verify            Skip readback verification
  --no-run               Stay in bootloader after writing
  --unlock               Try readout unprotect when erase returns NACK
  --help                 Show this help`;
}

function parseArgs(argv) {
  const args = {
    baud: 115200,
    packet: 256,
    timeout: 2000,
    parity: "even",
    reset: "dtr-high-rts-low",
    erase: true,
    verify: true,
    run: true,
    unlock: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`${arg} requires a value`);
      return argv[i];
    };

    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--port" || arg === "-p") args.port = next();
    else if (arg === "--file" || arg === "-f") args.file = next();
    else if (arg === "--baud" || arg === "-b") args.baud = Number.parseInt(next(), 10);
    else if (arg === "--address" || arg === "-a") args.address = parseNumber(next(), "address");
    else if (arg === "--packet") args.packet = Number.parseInt(next(), 10);
    else if (arg === "--timeout") args.timeout = Number.parseInt(next(), 10);
    else if (arg === "--parity") args.parity = next();
    else if (arg === "--reset") args.reset = next();
    else if (arg === "--no-erase") args.erase = false;
    else if (arg === "--no-verify") args.verify = false;
    else if (arg === "--no-run") args.run = false;
    else if (arg === "--unlock") args.unlock = true;
    else throw new Error(`Unknown option ${arg}`);
  }

  return args;
}

function parseNumber(value, label) {
  const parsed = value.trim().toLowerCase().startsWith("0x")
    ? Number.parseInt(value, 16)
    : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return parsed >>> 0;
}

async function loadSerialPort() {
  try {
    return await import("serialport");
  } catch (_) {
    throw new Error("CLI flashing requires the optional dependency 'serialport'. Run: npm install");
  }
}

async function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.port || !args.file) throw new Error("Missing required --port and --file\n\n" + usage());
  if (!["even", "none"].includes(args.parity)) throw new Error("--parity must be even or none");
  if (!Number.isInteger(args.packet) || args.packet < 1 || args.packet > 256) {
    throw new Error("--packet must be between 1 and 256");
  }

  const { SerialPort } = await loadSerialPort();
  const firmware = await loadFirmwarePath(args.file, readFile);
  const address = args.address ?? firmware.baseAddress ?? 0x08000000;

  const port = new SerialPort({
    path: args.port,
    baudRate: args.baud,
    dataBits: 8,
    stopBits: 1,
    parity: args.parity,
    autoOpen: false,
  });
  const transport = new NodeSerialTransport(port);
  const bootloader = new Stm32Bootloader(transport, {
    timeout: args.timeout,
    onProgress: ({ phase, offset, total }) => {
      const percent = Math.round((offset / total) * 100);
      process.stdout.write(`\r${phase} ${percent}%`);
      if (offset >= total) process.stdout.write("\n");
    },
  });

  async function enterAndSyncBootloader() {
    const stages = bootloaderEntryStages(args.reset);
    let info = null;
    let chipId = null;
    for (const [index, stage] of stages.entries()) {
      if (args.reset !== "none") {
        const suffix = stages.length > 1 ? ` (${stage.name}, ${index + 1}/${stages.length})` : "";
        console.log(`Entering bootloader via DTR/RTS${suffix}`);
        await enterBootloader(transport, delay, stage.config);
      }
      await transport.flushReadBuffer();
      await bootloader.sync();
      info = await bootloader.getCommands();
      chipId = await bootloader.getId();
      console.log(`Bootloader ${toHex(info.version)}, PID ${toHex(chipId, 4)}`);
      if (args.reset === "none") break;
    }
    return { info, chipId };
  }

  console.log(`Opening ${args.port} at ${args.baud} baud`);
  await transport.open();
  try {
    console.log(`Loaded ${basename(args.file)}: ${firmware.format.toUpperCase()}, ${firmware.bytes.length} bytes`);
    console.log(`Flash address: ${toHex(address, 8)}`);

    await enterAndSyncBootloader();

    if (args.erase) {
      try {
        const eraseMode = await bootloader.massErase();
        console.log(`Erase complete (${eraseMode})`);
      } catch (error) {
        if (/NACK/.test(error.message) && args.unlock) {
          console.log("Erase returned NACK; trying readout unprotect");
          await bootloader.readoutUnprotect();
          await enterAndSyncBootloader();
        } else {
          throw error;
        }
      }
    }

    await bootloader.writeMemory(address, firmware.bytes, args.packet);
    if (args.verify) await bootloader.verify(address, firmware.bytes, args.packet);
    if (args.run) await resetToRun(transport, delay, args.reset);
    console.log("Done");
  } finally {
    await transport.close();
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

export { main, parseArgs };
