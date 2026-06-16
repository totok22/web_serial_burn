import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseJsonc } from "./project-config.js";

export function serialFlashTaskDefinitions() {
  return [
    {
      label: "SerialFlash: Flash Latest Firmware",
      type: "serialFlash",
      action: "flashLatest",
      problemMatcher: [],
    },
    {
      label: "SerialFlash: Reset To Bootloader",
      type: "serialFlash",
      action: "bootloader",
      problemMatcher: [],
    },
    {
      label: "SerialFlash: Reset And Run",
      type: "serialFlash",
      action: "run",
      problemMatcher: [],
    },
  ];
}

export function mergeSerialFlashTasks(current) {
  const existingTasks = Array.isArray(current.tasks) ? current.tasks : [];
  const serialLabels = new Set(serialFlashTaskDefinitions().map((task) => task.label));
  return {
    version: current.version || "2.0.0",
    ...current,
    tasks: [
      ...existingTasks.filter((task) => !serialLabels.has(task.label)),
      ...serialFlashTaskDefinitions(),
    ],
  };
}

export async function writeProjectTasks(vscode) {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) throw new Error("Open a workspace before creating SerialFlash tasks.");

  const path = join(root, ".vscode", "tasks.json");
  await mkdir(dirname(path), { recursive: true });

  let current = {};
  try {
    current = parseJsonc(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const next = mergeSerialFlashTasks(current);
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`);
  return path;
}

export class SerialFlashTaskProvider {
  constructor(vscode, controller) {
    this.vscode = vscode;
    this.controller = controller;
    this.type = "serialFlash";
  }

  provideTasks() {
    return [
      this.makeTask("Flash Latest Firmware", "flashLatest"),
      this.makeTask("Reset To Bootloader", "bootloader"),
      this.makeTask("Reset And Run", "run"),
    ];
  }

  resolveTask(task) {
    const action = task.definition?.action;
    if (!action) return undefined;
    return this.makeTask(task.name, action);
  }

  makeTask(name, action) {
    const definition = { type: this.type, action };
    const execution = new this.vscode.CustomExecution(async () => this.makeTerminal(name, action));
    const task = new this.vscode.Task(
      definition,
      this.vscode.TaskScope.Workspace,
      name,
      "SerialFlash",
      execution,
      [],
    );
    task.presentationOptions = {
      reveal: this.vscode.TaskRevealKind.Always,
      panel: this.vscode.TaskPanelKind.Shared,
    };
    return task;
  }

  makeTerminal(name, action) {
    const writeEmitter = new this.vscode.EventEmitter();
    const closeEmitter = new this.vscode.EventEmitter();
    const run = async () => {
      writeEmitter.fire(`SerialFlash: ${name}\r\n`);
      try {
        if (action === "flashLatest") await this.controller.flashLatestFirmware();
        else if (action === "bootloader") await this.controller.resetToBootloader();
        else if (action === "run") await this.controller.resetAndRun();
        else throw new Error(`Unknown SerialFlash task action: ${action}`);
        writeEmitter.fire("SerialFlash task complete\r\n");
        closeEmitter.fire(0);
      } catch (error) {
        writeEmitter.fire(`SerialFlash task failed: ${error.message}\r\n`);
        closeEmitter.fire(1);
      }
    };

    return {
      onDidWrite: writeEmitter.event,
      onDidClose: closeEmitter.event,
      open: () => {
        run();
      },
      close: () => {},
    };
  }
}
