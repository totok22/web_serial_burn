const vscode = acquireVsCodeApi();

const refs = {
  firmware: document.getElementById("firmware"),
  port: document.getElementById("port"),
  reset: document.getElementById("reset"),
  baud: document.getElementById("baud"),
  address: document.getElementById("address"),
  options: document.getElementById("options"),
  phase: document.getElementById("phase"),
  progressText: document.getElementById("progressText"),
  bar: document.getElementById("bar"),
  log: document.getElementById("log"),
  history: document.getElementById("history"),
  diagnostics: document.getElementById("diagnostics"),
  troubleshooting: document.getElementById("troubleshooting"),
  inputs: Array.from(document.querySelectorAll("[data-setting]")),
  buttons: Array.from(document.querySelectorAll("button[data-action]")),
};

function setText(ref, value) {
  ref.textContent = value || "-";
}

function render(state) {
  const settings = state.settings || {};
  setText(refs.firmware, settings.firmware);
  setText(refs.port, settings.port);
  setText(refs.reset, settings.resetMode);
  setText(refs.baud, `${settings.baudRate || 115200} 8${settings.parity === "none" ? "N" : "E"}1`);
  setText(refs.address, settings.flashAddress || "0x08000000");

  const options = [
    settings.eraseBeforeWrite && "erase",
    settings.verifyAfterWrite && "verify",
    settings.runAfterWrite && "run",
    settings.unlockReadProtection && "unlock",
  ].filter(Boolean);
  setText(refs.options, options.join(" "));

  const progress = Number.isFinite(state.progress) ? state.progress : 0;
  refs.bar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
  refs.progressText.textContent = `${Math.round(progress)}%`;
  refs.phase.textContent = state.error || state.phase || (state.running ? "Flashing" : "Idle");
  document.body.dataset.running = state.running ? "true" : "false";

  for (const input of refs.inputs) {
    const key = input.dataset.setting;
    const value = key.includes(".")
      ? key.split(".").reduce((current, part) => current?.[part], settings)
      : settings[key];
    if (input.type === "checkbox") {
      input.checked = value === true;
    } else if (document.activeElement !== input) {
      input.value = value ?? "";
    }
    input.disabled = state.running === true;
  }

  for (const button of refs.buttons) {
    const allowRunning = button.dataset.allowRunning === "true";
    const requiresRunning = button.dataset.requiresRunning === "true";
    button.disabled = (state.running === true && !allowRunning) || (state.running !== true && requiresRunning);
  }

  refs.log.textContent = (state.log || []).slice(-18).join("\n");
  refs.history.replaceChildren(...(state.history || []).slice(0, 8).map((entry) => {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = entry.firmware || "Unknown firmware";
    const meta = document.createElement("span");
    meta.textContent = [entry.success === false ? "failed" : "done", entry.port, entry.resetMode].filter(Boolean).join(" / ");
    item.append(title, meta);
    return item;
  }));

  const diagnostics = state.diagnostics;
  refs.diagnostics.textContent = diagnostics
    ? [
        `Host: ${diagnostics.extensionHost.remoteName}`,
        `OS: ${diagnostics.extensionHost.platform} ${diagnostics.extensionHost.arch}`,
        `serialport: ${diagnostics.serialport.loaded ? "loaded" : diagnostics.serialport.error}`,
        `ports: ${diagnostics.ports.length}`,
        ...diagnostics.ports.map((port) => [
          `- ${port.path}`,
          port.manufacturer,
          port.serialNumber && `SN ${port.serialNumber}`,
        ].filter(Boolean).join(" ")),
      ].join("\n")
    : "";

  refs.troubleshooting.replaceChildren(...(state.troubleshooting || []).map((hint) => {
    const item = document.createElement("li");
    item.textContent = hint;
    return item;
  }));
}

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    vscode.postMessage({ type: "action", action: button.dataset.action });
  });
});

for (const input of refs.inputs) {
  const send = () => {
    let value = input.type === "checkbox" ? input.checked : input.value;
    if (input.inputMode === "numeric" && value !== "") value = Number(value);
    vscode.postMessage({
      type: "action",
      action: "saveSetting",
      key: input.dataset.setting,
      value,
    });
  };
  input.addEventListener("change", send);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      send();
      input.blur();
    }
  });
}

window.addEventListener("message", (event) => {
  if (event.data?.type === "state") render(event.data.state);
});

vscode.postMessage({ type: "ready" });
