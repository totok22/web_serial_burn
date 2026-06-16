import { enterBootloader, resetToRun, bootloaderEntryStages } from "./reset-timing.js";
import { ACK, NACK, SYNC, Stm32Bootloader, toHex } from "../stm32.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function defaultLog() {}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw new Error("Flash cancelled");
  }
}

function progressPercent({ offset, total }) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((offset / total) * 100)));
}

export async function syncBootloaderIgnoringNoise(transport, timeout) {
  const deadline = Date.now() + timeout;
  const ignored = [];
  await transport.flushReadBuffer();
  await transport.write([SYNC]);

  while (Date.now() < deadline) {
    const remaining = Math.max(1, deadline - Date.now());
    let byte;
    try {
      byte = (await transport.readExact(1, remaining))[0];
    } catch (error) {
      if (ignored.length > 0) {
        throw new Error(formatIgnoredSyncTimeout(ignored));
      }
      throw error;
    }
    if (byte === ACK) return ignored;
    if (byte === NACK) throw new Error("Bootloader returned NACK");
    ignored.push(byte);
  }

  throw new Error(formatIgnoredSyncTimeout(ignored));
}

function formatIgnoredSyncTimeout(ignored) {
  const preview = ignored.slice(0, 16).map((value) => toHex(value)).join(" ");
  const suffixText = ignored.length > 16 ? " ..." : "";
  return `读取超时 (等待 Bootloader ACK, 已忽略 ${ignored.length} 字节非 Bootloader 响应: ${preview}${suffixText})`;
}

export async function enterAndSyncBootloader({
  transport,
  bootloader,
  resetMode = "dtr-high-rts-low",
  timeout = bootloader.timeout ?? 2000,
  onLog = defaultLog,
  signal,
}) {
  const stages = bootloaderEntryStages(resetMode);
  let info = null;
  let chipId = null;

  for (const [index, stage] of stages.entries()) {
    throwIfAborted(signal);
    if (resetMode !== "none") {
      const suffix = stages.length > 1 ? ` (${stage.name}, ${index + 1}/${stages.length})` : "";
      onLog(`Entering bootloader via DTR/RTS${suffix}`);
      await enterBootloader(transport, delay, stage.config);
    }
    const ignored = await syncBootloaderIgnoringNoise(transport, timeout);
    if (ignored.length > 0) {
      const preview = ignored.slice(0, 16).map((byte) => toHex(byte)).join(" ");
      const suffixText = ignored.length > 16 ? " ..." : "";
      onLog(`Ignored ${ignored.length} non-bootloader byte(s) before ACK: ${preview}${suffixText}`);
    }
    info = await bootloader.getCommands();
    chipId = await bootloader.getId();
    onLog(`Bootloader ${toHex(info.version)}, PID ${toHex(chipId, 4)}`);
    if (resetMode === "none") break;
  }

  return { info, chipId };
}

export async function flashStm32Uart({
  transport,
  firmware,
  address = firmware?.baseAddress ?? 0x08000000,
  packetSize = 256,
  timeout = 2000,
  resetMode = "dtr-high-rts-low",
  erase = true,
  verify = true,
  run = true,
  unlock = false,
  close = true,
  onLog = defaultLog,
  onProgress = () => {},
  signal,
}) {
  if (!transport) throw new Error("Missing serial transport");
  if (!firmware?.bytes) throw new Error("Missing firmware bytes");

  const bootloader = new Stm32Bootloader(transport, {
    timeout,
    onProgress: (event) => {
      onProgress({ ...event, percent: progressPercent(event) });
    },
  });

  let success = false;
  await transport.open();
  try {
    throwIfAborted(signal);
    onLog(`Firmware: ${firmware.format?.toUpperCase?.() ?? "BIN"}, ${firmware.bytes.length} bytes`);
    onLog(`Flash address: ${toHex(address, 8)}`);

    await enterAndSyncBootloader({ transport, bootloader, resetMode, timeout, onLog, signal });

    if (erase) {
      try {
        const eraseMode = await bootloader.massErase();
        onLog(`Erase complete (${eraseMode})`);
      } catch (error) {
        if (/NACK/.test(error.message) && unlock) {
          onLog("Erase returned NACK; trying readout unprotect. This erases the whole chip.");
          await bootloader.readoutUnprotect();
          await enterAndSyncBootloader({ transport, bootloader, resetMode, timeout, onLog, signal });
        } else {
          throw error;
        }
      }
    } else {
      onLog("Erase skipped");
    }

    throwIfAborted(signal);
    await bootloader.writeMemory(address, firmware.bytes, packetSize);

    throwIfAborted(signal);
    if (verify) {
      await bootloader.verify(address, firmware.bytes, packetSize);
      onLog("Verify complete");
    } else {
      onLog("Verify skipped");
    }

    if (run) {
      await resetToRun(transport, delay, resetMode);
      onLog("Reset and run");
    }

    onLog("Done");
    success = true;
  } finally {
    if (close || !success) await transport.close();
  }
}
