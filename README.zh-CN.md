# SerialFlash

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

基于 Web Serial 和 STM32 USART Bootloader 的浏览器烧写工具，同时提供 Node.js CLI 便于硬件验证和自动化烧写。无需 ST-Link、无需安装软件——只需浏览器（或终端）和 USB-UART 转接板。

> **English users**: see [README.md](README.md)

---

## 该选哪个分支？

本项目有**两个分支**，分别适配不同场景：

| 分支 | 说明 | 适合 |
| ---- | ---- | ---- |
| [`main`](https://github.com/totok22/SerialFlash/tree/main)（当前） | **Web Serial + CLI** — 浏览器打开页面或用命令行烧录 | 不想装 VS Code、需要 CI/自动化、任何有浏览器的平台都能用 |
| [`vscode-extension`](https://github.com/totok22/SerialFlash/tree/vscode-extension) | **VS Code 插件** — 从插件市场安装，在编辑器里烧录 | 常用 VS Code 开发、想要一键集成烧录的开发者 |

两个分支共享相同的 STM32 UART ISP 核心逻辑、DTR/RTS 复位预设和固件解析。按你的场景选一个即可。

---

## 截图

![SerialFlash Web UI](docs/assets/web-ui.png)

---

## 功能

- STM32 UART ISP 自动进 Bootloader、擦除、写入、校验和运行。
- 支持 `.bin` 和 Intel HEX `.hex` 固件。
- 内置 CH340C 经典电路、CH340X 直连电路和常见 DTR/RTS 组合预设。
- 支持读保护解除、烧写后运行、完成后关闭串口。
- 明暗主题切换和中英文切换。
- 提供 Web UI 和 CLI 两种入口。

---

## 浏览器使用

Web Serial 需要 **Chrome 或 Edge**（或其他 Chromium 内核浏览器），并通过 HTTPS 或 localhost 打开页面。

### 快速启动

启动本地服务：

```bash
python3 -m http.server 8080
```

打开：

```
http://127.0.0.1:8080/index.html
```

或使用平台启动脚本：

- **macOS** — 双击 `start.command`
- **Windows** — 双击 `start.bat`

### 使用流程

1. 点击 **"选择并开启串口"**，授权并打开串口。
2. 选择 `.bin` 或 `.hex` 固件文件。
3. 选择 DTR/RTS 复位模式，常用预设为 **CH340C 经典电路** 和 **CH340X 直连电路**。
4. 按需设置擦除、完整校验、运行和关闭串口。
5. 点击 **"开始编程"**。

进度、阶段和日志实时显示。顶部栏可切换主题和语言。

---

## CLI 使用

安装依赖：

```bash
npm install
```

查看参数：

```bash
node src/cli.js --help
```

示例：

```bash
node src/cli.js \
  --port /dev/tty.usbserial-10 \
  --file firmware.hex \
  --reset ch340x \
  --timeout 3000 \
  --unlock
```

**macOS**：CH340 通常同时存在 `/dev/cu.*` 和 `/dev/tty.*`，自动 DTR/RTS 进 Bootloader 时优先使用 `/dev/tty.usbserial-*`。

**Windows**：串口通常为 `COM3`、`COM4` 等：

```bash
node src/cli.js --port COM3 --file firmware.hex --reset ch340x --timeout 3000 --unlock
```

---

## 硬件预设

项目内部统一约定：

- `true` 表示低电平。
- `false` 表示高电平。

Node `serialport` 的 modem 线布尔语义与项目约定相反，适配层（`src/node-serial-transport.js`）会自动取反；Web Serial 路径单独处理浏览器侧行为。

可用的复位预设：

| 预设 | 适用电路 |
| ---- | -------- |
| `ch340c` | CH340C 经典自动下载电路（DTR 低、RTS 高） |
| `ch340x` | CH340X 直连电路 |
| `dtr-high-rts-low` | 通用 — DTR 高复位、RTS 低进 BOOT |
| `none` | 不驱动控制线，手动按键进 Bootloader |

电路图、时序记录和排查经验见 [docs/CH340_HARDWARE.md](docs/CH340_HARDWARE.md)；协议包格式见 [docs/STM32_PROTOCOL.md](docs/STM32_PROTOCOL.md)。

---

## CLI 参数

| 选项 | CLI 参数 | 默认值 | 说明 |
| ---- | -------- | ------ | ---- |
| 串口 | `--port` | — | 串口路径（必填） |
| 固件 | `--file` | — | `.hex` 或 `.bin` 固件路径（必填） |
| 波特率 | `--baud` | `115200` | USART 波特率 |
| 复位模式 | `--reset` | `ch340c` | DTR/RTS 预设 |
| 超时 | `--timeout` | `2000` | 读超时（毫秒） |
| 跳过擦除 | `--no-erase` | `false` | 写入前不整片擦除 |
| 跳过校验 | `--no-verify` | `false` | 写入后不读回校验 |
| 跳过运行 | `--no-run` | `false` | 烧写后不复位运行 |
| 不关串口 | `--no-close` | `false` | 烧写后保持串口打开 |
| 解除读保护 | `--unlock` | `false` | 尝试解除读保护（会整片擦除） |

---

## 开发

```bash
npm install
npm test

# Web UI
python3 -m http.server 8080

# CLI
node src/cli.js --help
```

核心 STM32 UART ISP 逻辑在 `src/stm32.js` 和 `src/firmware.js`。传输适配层在 `src/serial-transport.js`（Web Serial）和 `src/node-serial-transport.js`（Node `serialport`）。架构与约定见 [AGENTS.md](AGENTS.md)。

---

## 已知限制

- **Web Serial 必须由用户点击触发**串口授权——浏览器安全策略。
- **当前仅支持 STM32 USART Bootloader**——不支持 SWD、DFU 等其他协议。
- **不同下载板的 DTR/RTS 极性差异较大**，新增板型前应先用 CLI 或 Web 预设组合验证。

---

## 许可证

MIT — 详见 [LICENSE](LICENSE)。
