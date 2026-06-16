import test from "node:test";
import assert from "node:assert/strict";
import { activateWithVscode } from "../src/vscode/extension.js";

function fakeVscode({ remoteName = "" } = {}) {
  const registeredCommands = [];
  const treeProviders = [];
  const taskProviders = [];
  const statusBarItems = [];
  const warnings = [];
  const outputLines = [];
  const disposables = [];

  return {
    registeredCommands,
    treeProviders,
    taskProviders,
    statusBarItems,
    warnings,
    outputLines,
    env: {
      remoteName,
    },
    StatusBarAlignment: { Left: 1 },
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    TaskScope: { Workspace: 1 },
    TaskRevealKind: { Always: 1 },
    TaskPanelKind: { Shared: 1 },
    ThemeIcon: class {
      constructor(id) {
        this.id = id;
      }
    },
    EventEmitter: class {
      constructor() {
        this.event = () => {};
      }
      fire() {}
    },
    CustomExecution: class {
      constructor(callback) {
        this.callback = callback;
      }
    },
    Task: class {
      constructor(definition, scope, name, source, execution, problemMatchers) {
        Object.assign(this, { definition, scope, name, source, execution, problemMatchers });
      }
    },
    Uri: {
      joinPath(uri, ...parts) {
        return { fsPath: [uri.fsPath, ...parts].join("/") };
      },
    },
    ViewColumn: { One: 1 },
    window: {
      createOutputChannel() {
        return {
          appendLine(line) {
            outputLines.push(line);
          },
          show() {},
          dispose() {},
        };
      },
      showWarningMessage(message, ...actions) {
        warnings.push({ message, actions });
        return Promise.resolve(undefined);
      },
      createStatusBarItem() {
        const item = {
          show() {},
          dispose() {},
        };
        statusBarItems.push(item);
        return item;
      },
      registerTreeDataProvider(id, provider) {
        treeProviders.push({ id, provider });
        return { dispose() {} };
      },
    },
    commands: {
      registerCommand(id, callback) {
        registeredCommands.push({ id, callback });
        const disposable = { dispose() {} };
        disposables.push(disposable);
        return disposable;
      },
      executeCommand: async () => {},
    },
    tasks: {
      registerTaskProvider(type, provider) {
        taskProviders.push({ type, provider });
        return { dispose() {} };
      },
    },
    workspace: {
      workspaceFolders: [],
      getConfiguration() {
        return {
          get() {
            return undefined;
          },
          inspect() {
            return {};
          },
          update: async () => {},
        };
      },
    },
    ConfigurationTarget: { Workspace: 1 },
  };
}

function fakeContext(globalValues = {}) {
  return {
    extensionUri: { fsPath: "/extension" },
    subscriptions: [],
    globalState: {
      get(_key, fallback) {
        return globalValues[_key] ?? fallback;
      },
      update: async () => {},
    },
  };
}

test("activateWithVscode registers commands, sidebar, and task provider", () => {
  const vscode = fakeVscode();
  const context = fakeContext();

  activateWithVscode(vscode, context);

  assert.ok(vscode.registeredCommands.some((command) => command.id === "serialFlash.flashLatestFirmware"));
  assert.ok(vscode.registeredCommands.some((command) => command.id === "serialFlash.selectProjectProfile"));
  assert.deepEqual(vscode.treeProviders.map((item) => item.id), ["serialFlash.sidebar"]);
  assert.deepEqual(vscode.taskProviders.map((item) => item.type), ["serialFlash"]);
  assert.ok(context.subscriptions.length > 0);
});

test("activateWithVscode warns when extension host is remote", () => {
  const vscode = fakeVscode({ remoteName: "wsl" });
  const context = fakeContext();

  activateWithVscode(vscode, context);

  assert.equal(vscode.warnings.length, 1);
  assert.match(vscode.warnings[0].message, /Extension Host 'wsl'/);
  assert.ok(vscode.outputLines.some((line) => line.includes("Run Diagnostics")));
});

test("activateWithVscode initializes status bar from remembered port", () => {
  const vscode = fakeVscode();
  const context = fakeContext({ "serialFlash.lastSuccessfulPort": "/dev/tty.usbserial-10" });

  activateWithVscode(vscode, context);

  assert.equal(vscode.statusBarItems[0].text, "SerialFlash: /dev/tty.usbserial-10");
});
