import { readFlashHistory } from "./history.js";
import { readFlashSettings } from "./settings.js";

class SerialFlashTreeItem {
  constructor(vscode, label, collapsibleState, options = {}) {
    this.label = label;
    this.collapsibleState = collapsibleState;
    this.description = options.description;
    this.tooltip = options.tooltip;
    this.command = options.command;
    this.contextValue = options.contextValue;
    this.iconPath = options.icon && new vscode.ThemeIcon(options.icon);
  }
}

export class SerialFlashSidebarProvider {
  constructor(vscode, context) {
    this.vscode = vscode;
    this.context = context;
    this.onDidChangeTreeDataEmitter = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
  }

  refresh() {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(item) {
    return item;
  }

  getChildren(item) {
    if (!item) return this.rootItems();
    if (item.contextValue === "serialFlash.current") return this.currentItems();
    if (item.contextValue === "serialFlash.actions") return this.actionItems();
    if (item.contextValue === "serialFlash.history") return this.historyItems();
    return [];
  }

  rootItems() {
    const collapsed = this.vscode.TreeItemCollapsibleState.Collapsed;
    const expanded = this.vscode.TreeItemCollapsibleState.Expanded;
    return [
      new SerialFlashTreeItem(this.vscode, "Current", expanded, {
        icon: "settings-gear",
        contextValue: "serialFlash.current",
      }),
      new SerialFlashTreeItem(this.vscode, "Actions", expanded, {
        icon: "zap",
        contextValue: "serialFlash.actions",
      }),
      new SerialFlashTreeItem(this.vscode, "History", collapsed, {
        icon: "history",
        contextValue: "serialFlash.history",
      }),
    ];
  }

  currentItems() {
    const settings = readFlashSettings(this.vscode, this.context);
    const none = this.vscode.TreeItemCollapsibleState.None;
    return [
      new SerialFlashTreeItem(this.vscode, settings.firmware || "No firmware selected", none, {
        description: "firmware",
        icon: "file-binary",
        command: { command: "serialFlash.selectFirmware", title: "Select Firmware" },
      }),
      new SerialFlashTreeItem(this.vscode, settings.port || "No port selected", none, {
        description: "port",
        icon: "plug",
        command: { command: "serialFlash.selectSerialPort", title: "Select Serial Port" },
      }),
      new SerialFlashTreeItem(this.vscode, settings.resetMode, none, {
        description: `${settings.baudRate} 8${settings.parity === "none" ? "N" : "E"}1`,
        icon: "circuit-board",
        command: { command: "serialFlash.selectResetMode", title: "Select Reset Mode" },
      }),
    ];
  }

  actionItems() {
    const none = this.vscode.TreeItemCollapsibleState.None;
    return [
      new SerialFlashTreeItem(this.vscode, "Flash Latest Firmware", none, {
        icon: "rocket",
        command: { command: "serialFlash.flashLatestFirmware", title: "Flash Latest Firmware" },
      }),
      new SerialFlashTreeItem(this.vscode, "Open Flasher Panel", none, {
        icon: "layout",
        command: { command: "serialFlash.openPanel", title: "Open Flasher Panel" },
      }),
      new SerialFlashTreeItem(this.vscode, "Select Project Profile", none, {
        icon: "layers",
        command: { command: "serialFlash.selectProjectProfile", title: "Select Project Profile" },
      }),
      new SerialFlashTreeItem(this.vscode, "Show Output", none, {
        icon: "output",
        command: { command: "serialFlash.showOutput", title: "Show Output" },
      }),
      new SerialFlashTreeItem(this.vscode, "Run Diagnostics", none, {
        icon: "debug-alt",
        command: { command: "serialFlash.runDiagnostics", title: "Run Diagnostics" },
      }),
    ];
  }

  historyItems() {
    const history = readFlashHistory(this.context);
    const none = this.vscode.TreeItemCollapsibleState.None;
    if (history.length === 0) {
      return [
        new SerialFlashTreeItem(this.vscode, "No flash history", none, {
          icon: "circle-slash",
        }),
      ];
    }
    return history.slice(0, 8).map((entry) => new SerialFlashTreeItem(this.vscode, entry.firmware || "Unknown firmware", none, {
      description: entry.port || "",
      tooltip: [
        entry.time,
        entry.port,
        entry.resetMode,
        entry.address,
        entry.bytes ? `${entry.bytes} bytes` : "",
      ].filter(Boolean).join("\n"),
      icon: entry.success === false ? "error" : "check",
    }));
  }
}
