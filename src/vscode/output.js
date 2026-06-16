export function createSerialFlashOutput(vscode) {
  const channel = vscode.window.createOutputChannel("SerialFlash");
  const recent = [];

  function append(message) {
    const stamp = new Date().toLocaleTimeString();
    const line = `[SerialFlash ${stamp}] ${message}`;
    recent.push(line);
    if (recent.length > 120) recent.splice(0, recent.length - 120);
    channel.appendLine(line);
  }

  return {
    channel,
    append,
    recent() {
      return [...recent];
    },
    show() {
      channel.show(true);
    },
    dispose() {
      channel.dispose();
    },
  };
}
