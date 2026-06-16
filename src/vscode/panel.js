export class SerialFlashPanel {
  constructor(vscode, context, output) {
    this.vscode = vscode;
    this.context = context;
    this.output = output;
    this.panel = null;
    this.controller = null;
  }

  show(controller) {
    this.controller = controller;
    if (this.panel) {
      this.panel.reveal(this.vscode.ViewColumn.One);
      this.postState(controller.panelState());
      return;
    }

    this.panel = this.vscode.window.createWebviewPanel(
      "serialFlash.panel",
      "SerialFlash",
      this.vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          this.vscode.Uri.joinPath(this.context.extensionUri, "src", "vscode", "media"),
        ],
      },
    );

    this.panel.webview.html = this.html();
    this.panel.webview.onDidReceiveMessage((message) => this.handleMessage(message));
    this.panel.onDidDispose(() => {
      this.panel = null;
    });
    this.postState(controller.panelState());
  }

  postState(state) {
    this.panel?.webview.postMessage({ type: "state", state });
  }

  async handleMessage(message) {
    if (!this.controller) return;
    if (message?.type === "ready") {
      this.postState(this.controller.panelState());
      return;
    }
    if (message?.type !== "action") return;

    const action = message.action;
    if (action === "flash") await this.controller.flashLatestFirmware();
    if (action === "selectFirmware") await this.controller.selectFirmware();
    if (action === "selectPort") await this.controller.selectSerialPort(true);
    if (action === "selectReset") await this.controller.selectResetMode();
    if (action === "bootloader") await this.controller.resetToBootloader();
    if (action === "run") await this.controller.resetAndRun();
    if (action === "cancel") this.controller.cancelFlash();
    if (action === "output") this.output.show();
    if (action === "diagnostics") await this.controller.runDiagnostics();
    if (action === "erase") await this.controller.eraseChip();
    if (action === "verify") await this.controller.verifyLatestFirmware();
    if (action === "unlock") await this.controller.unlockReadProtection();
    if (action === "closePort") await this.controller.closeActivePort();
    if (action === "projectConfig") await this.controller.createProjectConfig();
    if (action === "createTasks") await this.controller.createTasks();
    if (action === "createProfile") await this.controller.createProjectProfile();
    if (action === "selectProfile") await this.controller.selectProjectProfile();
    if (action === "clearHistory") await this.controller.clearHistory();
    if (action === "clearRemembered") await this.controller.clearRememberedDevice();
    if (action === "saveSetting") await this.controller.updateSetting(message.key, message.value);
  }

  html() {
    const webview = this.panel.webview;
    const cssUri = webview.asWebviewUri(this.vscode.Uri.joinPath(this.context.extensionUri, "src", "vscode", "media", "panel.css"));
    const jsUri = webview.asWebviewUri(this.vscode.Uri.joinPath(this.context.extensionUri, "src", "vscode", "media", "panel.js"));
    const nonce = String(Date.now());

    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${cssUri}">
  <title>SerialFlash</title>
</head>
<body>
  <main class="shell">
    <section class="summary">
      <div>
        <p class="kicker">STM32 UART ISP</p>
        <h1>SerialFlash</h1>
      </div>
      <div class="meter">
        <span id="phase">Idle</span>
        <strong id="progressText">0%</strong>
      </div>
    </section>

    <section class="fields">
      <div class="field">
        <span>Firmware</span>
        <strong id="firmware">-</strong>
        <button data-action="selectFirmware">Change</button>
      </div>
      <div class="field">
        <span>Port</span>
        <strong id="port">-</strong>
        <button data-action="selectPort">Change</button>
      </div>
      <div class="field">
        <span>Reset</span>
        <strong id="reset">-</strong>
        <button data-action="selectReset">Change</button>
      </div>
      <div class="field compact">
        <span>Baud</span>
        <strong id="baud">115200 8E1</strong>
        <span>Address</span>
        <strong id="address">0x08000000</strong>
      </div>
      <div class="field compact">
        <span>Options</span>
        <strong id="options">erase verify run</strong>
      </div>
    </section>

    <section class="editor">
      <label>
        Baud
        <input id="baudInput" data-setting="baudRate" inputmode="numeric">
      </label>
      <label>
        Address
        <input id="addressInput" data-setting="flashAddress" placeholder="HEX base address">
      </label>
      <label>
        Packet
        <input id="packetInput" data-setting="packetSize" inputmode="numeric">
      </label>
      <label>
        Timeout
        <input id="timeoutInput" data-setting="timeout" inputmode="numeric">
      </label>
      <label>
        Parity
        <select id="parityInput" data-setting="parity">
          <option value="even">even</option>
          <option value="none">none</option>
        </select>
      </label>
      <label>
        BOOT0 High
        <select data-setting="customReset.boot0High">
          <option value="dtr-true">DTR true</option>
          <option value="dtr-false">DTR false</option>
          <option value="rts-true">RTS true</option>
          <option value="rts-false">RTS false</option>
        </select>
      </label>
      <label>
        BOOT0 Low
        <select data-setting="customReset.boot0Low">
          <option value="">inverse</option>
          <option value="dtr-true">DTR true</option>
          <option value="dtr-false">DTR false</option>
          <option value="rts-true">RTS true</option>
          <option value="rts-false">RTS false</option>
        </select>
      </label>
      <label>
        RESET Assert
        <select data-setting="customReset.resetAssert">
          <option value="dtr-true">DTR true</option>
          <option value="dtr-false">DTR false</option>
          <option value="rts-true">RTS true</option>
          <option value="rts-false">RTS false</option>
        </select>
      </label>
    </section>

    <section class="checks">
      <label><input type="checkbox" data-setting="eraseBeforeWrite"> Erase</label>
      <label><input type="checkbox" data-setting="verifyAfterWrite"> Verify</label>
      <label><input type="checkbox" data-setting="runAfterWrite"> Run</label>
      <label><input type="checkbox" data-setting="closePortAfterWrite"> Close</label>
      <label><input type="checkbox" data-setting="unlockReadProtection"> Unlock</label>
    </section>

    <section class="actions">
      <button class="primary" data-action="flash">Flash</button>
      <button data-action="cancel" data-allow-running="true" data-requires-running="true">Cancel</button>
      <button data-action="bootloader">Bootloader</button>
      <button data-action="run">Run</button>
      <button data-action="closePort">Close Port</button>
      <button data-action="verify">Verify</button>
      <button data-action="erase">Erase</button>
      <button data-action="unlock">Unlock</button>
      <button data-action="output" data-allow-running="true">Output</button>
      <button data-action="diagnostics" data-allow-running="true">Diagnostics</button>
      <button data-action="selectProfile">Profile</button>
      <button data-action="createProfile">Save Profile</button>
      <button data-action="projectConfig">Project Config</button>
      <button data-action="createTasks">Tasks</button>
    </section>

    <section class="progress">
      <div id="bar"></div>
    </section>

    <section class="lower">
      <div>
        <header>
          <h2>Log</h2>
          <button data-action="output" data-allow-running="true">Open Output</button>
        </header>
        <pre id="log"></pre>
      </div>
      <div>
        <header>
          <h2>History</h2>
          <button data-action="clearHistory">Clear</button>
        </header>
        <ol id="history"></ol>
      </div>
      <div>
        <header>
          <h2>Diagnostics</h2>
          <button data-action="diagnostics" data-allow-running="true">Run</button>
        </header>
        <pre id="diagnostics"></pre>
      </div>
      <div>
        <header>
          <h2>Troubleshooting</h2>
          <button data-action="output" data-allow-running="true">Open Output</button>
        </header>
        <ul id="troubleshooting"></ul>
      </div>
    </section>
  </main>
  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }
}
