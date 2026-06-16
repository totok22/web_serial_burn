export function extensionHostLabel(vscode) {
  return vscode.env?.remoteName || "local";
}

export function isRemoteExtensionHost(vscode) {
  return extensionHostLabel(vscode) !== "local";
}

export function remoteHostWarning(vscode) {
  const host = extensionHostLabel(vscode);
  if (host === "local") return "";
  return `SerialFlash is running on VS Code Extension Host '${host}'. Serial ports belong to that machine, not necessarily the computer running the VS Code UI.`;
}

export function warnIfRemoteExtensionHost(vscode, output) {
  const warning = remoteHostWarning(vscode);
  if (!warning) return false;
  output.append(warning);
  output.append("Use SerialFlash: Run Diagnostics to confirm which host can see the serial devices.");
  vscode.window.showWarningMessage(warning, "Run Diagnostics", "Open Output").then((choice) => {
    if (choice === "Run Diagnostics") vscode.commands.executeCommand("serialFlash.runDiagnostics");
    if (choice === "Open Output") output.show();
  });
  return true;
}
