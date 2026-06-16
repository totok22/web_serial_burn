function invertChoice(choice) {
  return choice.replace("true", "TMP").replace("false", "true").replace("TMP", "false");
}

function applyChoice(signals, choice) {
  const [name, rawValue] = choice.split("-");
  const value = rawValue === "true";
  if (name === "dtr") signals.dataTerminalReady = value;
  if (name === "rts") signals.requestToSend = value;
}

function signalsForChoice(choice) {
  const signals = {};
  applyChoice(signals, choice);
  return signals;
}

function isCh340xMode(modeOrConfig) {
  return modeOrConfig === "ch340x";
}

const RESET_PRESETS = {
  "dtr-high-rts-low": { boot0High: "rts-true", boot0Low: "rts-false", resetAssert: "dtr-false" },
  "dtr-low-rts-high": { boot0High: "rts-true", boot0Low: "rts-false", resetAssert: "dtr-true" },
  "boot-rts-low-reset-dtr-low": { boot0High: "rts-true", boot0Low: "rts-false", resetAssert: "dtr-true" },
  "boot-rts-low-reset-dtr-high": { boot0High: "rts-true", boot0Low: "rts-false", resetAssert: "dtr-false" },
  "boot-rts-high-reset-dtr-low": { boot0High: "rts-false", boot0Low: "rts-true", resetAssert: "dtr-true" },
  "boot-rts-high-reset-dtr-high": { boot0High: "rts-false", boot0Low: "rts-true", resetAssert: "dtr-false" },
  "boot-dtr-low-reset-rts-low": { boot0High: "dtr-true", boot0Low: "dtr-false", resetAssert: "rts-true" },
  "boot-dtr-low-reset-rts-high": { boot0High: "dtr-true", boot0Low: "dtr-false", resetAssert: "rts-false" },
  "boot-dtr-high-reset-rts-low": { boot0High: "dtr-false", boot0Low: "dtr-true", resetAssert: "rts-true" },
  "boot-dtr-high-reset-rts-high": { boot0High: "dtr-false", boot0Low: "dtr-true", resetAssert: "rts-false" },
};

function normalizeResetConfig(modeOrConfig) {
  if (!modeOrConfig) return RESET_PRESETS["dtr-high-rts-low"];
  if (isCh340xMode(modeOrConfig) || modeOrConfig === "none") return null;
  if (RESET_PRESETS[modeOrConfig]) return RESET_PRESETS[modeOrConfig];

  if (typeof modeOrConfig === "object") {
    const boot0High = modeOrConfig.boot0High ?? "dtr-false";
    return {
      boot0High,
      boot0Low: modeOrConfig.boot0Low ?? invertChoice(boot0High),
      resetAssert: modeOrConfig.resetAssert ?? "rts-true",
    };
  }

  return { boot0High: "dtr-false", boot0Low: "dtr-true", resetAssert: "rts-true" };
}

export function bootloaderEntryStages(modeOrConfig) {
  if (isCh340xMode(modeOrConfig)) {
    return [
      {
        name: "CH340X 直连电路",
        config: "ch340x",
      },
    ];
  }
  return [{ name: "default", config: modeOrConfig }];
}

// STM32 进入 Bootloader 物理时序。项目内部约定 true 为低电平、false 为高电平。
export async function enterBootloader(transport, delay, modeOrConfig) {
  if (isCh340xMode(modeOrConfig)) {
    // CH340X 直连：先释放 RESET 并保持 BOOT0 运行态，再建立 BOOT 条件、脉冲 RESET。
    await transport.setSignals({ requestToSend: false, dataTerminalReady: true });
    await delay(150);

    await transport.setSignals({ requestToSend: true, dataTerminalReady: true });
    await delay(150);

    await transport.setSignals({ requestToSend: true, dataTerminalReady: false });
    await delay(150);

    await transport.setSignals({ requestToSend: true, dataTerminalReady: true });
    await delay(1000);
    return;
  }

  const config = normalizeResetConfig(modeOrConfig);
  if (!config) return;

  await transport.setSignals(signalsForChoice(config.boot0High));
  await delay(100);

  await transport.setSignals(signalsForChoice(config.resetAssert));
  await delay(100);

  await transport.setSignals(signalsForChoice(invertChoice(config.resetAssert)));
  await delay(800);
}

export async function resetToRun(transport, delay, modeOrConfig) {
  if (isCh340xMode(modeOrConfig)) {
    // CH340X 直连：退出 BOOT 条件后脉冲 RESET，运行用户程序。
    await transport.setSignals({ requestToSend: false, dataTerminalReady: false });
    await delay(250);

    await transport.setSignals({ requestToSend: false, dataTerminalReady: true });
    await delay(250);

    await transport.setSignals({ requestToSend: false, dataTerminalReady: false });
    await delay(1000);
    return;
  }

  const config = normalizeResetConfig(modeOrConfig);
  if (!config) return;

  await transport.setSignals(signalsForChoice(config.boot0Low));
  await delay(100);

  await transport.setSignals(signalsForChoice(config.resetAssert));
  await delay(100);

  await transport.setSignals(signalsForChoice(invertChoice(config.resetAssert)));
  await delay(200);

  await transport.setSignals({ dataTerminalReady: false, requestToSend: false });
  await delay(800);
}
