import { createSerialFlashOutput } from "./output.js";
import { SerialFlashPanel } from "./panel.js";
import { SerialFlashController } from "./commands.js";
import { SerialFlashSidebarProvider } from "./sidebar.js";
import { SerialFlashTaskProvider } from "./tasks.js";
import { warnIfRemoteExtensionHost } from "./environment.js";

export function activateWithVscode(vscode, context) {
  const output = createSerialFlashOutput(vscode);
  const panel = new SerialFlashPanel(vscode, context, output);
  const sidebar = new SerialFlashSidebarProvider(vscode, context);
  const controller = new SerialFlashController(vscode, context, output, panel, sidebar);
  controller.register();
  warnIfRemoteExtensionHost(vscode, output);
  controller.postPanelState();
  context.subscriptions.push(
    output,
    vscode.window.registerTreeDataProvider("serialFlash.sidebar", sidebar),
    vscode.tasks.registerTaskProvider("serialFlash", new SerialFlashTaskProvider(vscode, controller)),
  );
  return controller;
}
