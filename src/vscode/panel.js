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
    <section class="hero">
      <div class="hero-title">
        <p class="kicker">STM32 UART ISP</p>
        <h1>STM32 Serial Flasher</h1>
        <p class="subtitle">本地 VS Code 插件通过 Extension Host 串口烧录，不经过浏览器 Web Serial。</p>
      </div>
      <div class="status-card">
        <span class="label">当前状态</span>
        <strong id="phase">Idle</strong>
        <span id="progressText">0%</span>
      </div>
    </section>

    <section class="main-grid">
      <div class="panel-card setup-card">
        <header class="section-heading">
          <div>
            <h2>烧录目标</h2>
            <p>日常只需要确认这三项，然后执行烧录。</p>
          </div>
          <button data-action="diagnostics" data-allow-running="true">诊断</button>
        </header>

        <div class="target-list">
          <div class="target-row">
            <span class="target-key">固件</span>
            <div>
              <strong id="firmware">-</strong>
              <small id="firmwareHint">未选择时会按工作区自动发现。</small>
            </div>
            <button data-action="selectFirmware">选择</button>
          </div>
          <div class="target-row">
            <span class="target-key">串口</span>
            <div>
              <strong id="port">-</strong>
              <small id="portHint">macOS 自动复位优先使用 /dev/tty.usbserial-*。</small>
            </div>
            <button data-action="selectPort">选择</button>
          </div>
          <div class="target-row">
            <span class="target-key">复位</span>
            <div>
              <strong id="reset">-</strong>
              <small id="resetHint">CH340C 与 CH340X 电路不要混用预设。</small>
            </div>
            <button data-action="selectReset">选择</button>
          </div>
        </div>
      </div>

      <div class="panel-card run-card">
        <header class="section-heading">
          <div>
            <h2>执行</h2>
            <p id="runSummary">115200 8E1 / 0x08000000</p>
          </div>
        </header>
        <button class="primary" data-action="flash">开始烧录</button>
        <button data-action="cancel" data-allow-running="true" data-requires-running="true">取消</button>
        <div class="progress" aria-label="Flash progress">
          <div id="bar"></div>
        </div>
        <div class="quick-actions">
          <button data-action="bootloader">进 Bootloader</button>
          <button data-action="run">复位运行</button>
          <button data-action="output" data-allow-running="true">输出</button>
        </div>
        <div class="option-pills" id="optionPills"></div>
      </div>
    </section>

    <section class="advanced">
      <details>
        <summary>
          <span>烧录参数</span>
          <small>波特率、地址、包大小和写入选项</small>
        </summary>
        <div class="editor">
          <label>
            <span>波特率</span>
            <input id="baudInput" data-setting="baudRate" inputmode="numeric">
            <small>STM32 USART Bootloader 常用 115200。</small>
          </label>
          <label>
            <span>Flash 地址</span>
            <input id="addressInput" data-setting="flashAddress" placeholder="HEX 可留空使用文件地址">
            <small>BIN 默认 0x08000000；HEX 可使用文件内 base address。</small>
          </label>
          <label>
            <span>包大小</span>
            <input id="packetInput" data-setting="packetSize" inputmode="numeric">
            <small>STM32 写入包最大 256 字节。</small>
          </label>
          <label>
            <span>超时 ms</span>
            <input id="timeoutInput" data-setting="timeout" inputmode="numeric">
            <small>复位进入 Bootloader 的等待不要随意缩短。</small>
          </label>
          <label>
            <span>校验位</span>
            <select id="parityInput" data-setting="parity">
              <option value="even">even</option>
              <option value="none">none</option>
            </select>
            <small>默认 8E1。</small>
          </label>
        </div>
        <div class="checks">
          <label><input type="checkbox" data-setting="eraseBeforeWrite"> 烧录前擦除</label>
          <label><input type="checkbox" data-setting="verifyAfterWrite"> 写入后校验</label>
          <label><input type="checkbox" data-setting="runAfterWrite"> 成功后运行</label>
          <label><input type="checkbox" data-setting="closePortAfterWrite"> 完成后关闭串口</label>
        </div>
      </details>

      <details>
        <summary>
          <span>硬件复位</span>
          <small>仅在 resetMode 为 custom 时需要改 DTR/RTS 映射</small>
        </summary>
        <p class="note">项目内部约定 true 为低电平、false 为高电平；Node serialport 的布尔值已在传输层统一取反。</p>
        <div class="editor compact-editor">
          <label>
            <span>BOOT0 High</span>
            <select data-setting="customReset.boot0High">
              <option value="dtr-true">DTR true</option>
              <option value="dtr-false">DTR false</option>
              <option value="rts-true">RTS true</option>
              <option value="rts-false">RTS false</option>
            </select>
          </label>
          <label>
            <span>BOOT0 Low</span>
            <select data-setting="customReset.boot0Low">
              <option value="">inverse</option>
              <option value="dtr-true">DTR true</option>
              <option value="dtr-false">DTR false</option>
              <option value="rts-true">RTS true</option>
              <option value="rts-false">RTS false</option>
            </select>
          </label>
          <label>
            <span>RESET Assert</span>
            <select data-setting="customReset.resetAssert">
              <option value="dtr-true">DTR true</option>
              <option value="dtr-false">DTR false</option>
              <option value="rts-true">RTS true</option>
              <option value="rts-false">RTS false</option>
            </select>
          </label>
        </div>
      </details>

      <details>
        <summary>
          <span>项目与自动化</span>
          <small>保存配置、profile 和 VS Code Tasks</small>
        </summary>
        <div class="action-row">
          <button data-action="selectProfile">选择 Profile</button>
          <button data-action="createProfile">保存 Profile</button>
          <button data-action="projectConfig">写入项目配置</button>
          <button data-action="createTasks">生成 Tasks</button>
        </div>
      </details>

      <details>
        <summary>
          <span>维护与危险操作</span>
          <small>擦除、校验、解除读保护、释放串口</small>
        </summary>
        <div class="danger-zone">
          <label><input type="checkbox" data-setting="unlockReadProtection"> 允许解除读保护</label>
          <p class="note">解除读保护会触发整片擦除，只在确认芯片处于读保护状态时使用。</p>
          <div class="action-row">
            <button data-action="verify">校验固件</button>
            <button data-action="erase">擦除芯片</button>
            <button data-action="unlock" class="danger">解除读保护</button>
            <button data-action="closePort">关闭串口</button>
            <button data-action="clearRemembered">清除记忆</button>
          </div>
        </div>
      </details>
    </section>

    <section class="lower">
      <div class="panel-card">
        <header>
          <h2>最近日志</h2>
          <button data-action="output" data-allow-running="true">完整输出</button>
        </header>
        <pre id="log"></pre>
      </div>
      <div class="panel-card">
        <header>
          <h2>历史记录</h2>
          <button data-action="clearHistory">清空</button>
        </header>
        <ol id="history"></ol>
      </div>
      <div class="panel-card">
        <header>
          <h2>诊断</h2>
          <button data-action="diagnostics" data-allow-running="true">运行</button>
        </header>
        <pre id="diagnostics"></pre>
      </div>
      <div class="panel-card">
        <header>
          <h2>Troubleshooting</h2>
          <button data-action="output" data-allow-running="true">输出</button>
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
