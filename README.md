# STM32 Serial Flasher (SerialFlash)

通过 STM32 USART Bootloader 和本机串口，在 VS Code 里直接烧录 `.hex` / `.bin` 固件。无需 ST-Link、无需外部命令行工具，进入 Bootloader、擦除、写入、校验、复位运行全部在编辑器内完成。

适用于使用 CH340 等 USB-UART 桥 + STM32 自动下载电路的开发板。

---

## 主要特性

- 自动扫描工作区中的 `.hex` / `.bin` 固件，按修改时间、路径和格式排序，单一候选时可自动选用。
- 一条命令即可烧录：进入 Bootloader → 擦除 → 写入 → 校验 → 复位运行。
- 记住上次成功的端口、固件、复位模式和波特率，下次直接复用。
- 多种入口：Activity Bar 侧边栏、Webview 烧录面板、命令面板、文件右键菜单、状态栏、VS Code Tasks。
- 内置多种 CH340 复位时序预设，并支持完全自定义 DTR/RTS 映射。
- 失败时在 Output 中给出针对超时、NACK、串口占用、权限、校验失败的排查建议。
- 记录最近烧录历史，可保存多套项目配置（profile）在不同板卡间切换。
- 硬件访问始终由 Extension Host 中的 Node `serialport` 执行，不经过浏览器 Web Serial。

---

## 环境要求

- VS Code 1.90 或更新版本（Desktop）。
- 本机已连接基于 USART Bootloader 的 STM32 开发板，以及可被系统识别的 USB-UART 串口。
- 无需额外安装驱动以外的工具，插件自带 `serialport` 原生依赖。

> 运行边界（Remote / Web）见下文「运行环境与边界」。

---

## 快速开始

1. 在 VS Code 中打开你的固件工程文件夹（包含 `.hex` / `.bin` 产物的工作区）。
2. 点击 Activity Bar 上的 **SerialFlash** 图标，打开侧边栏。
3. 在 **Current** 区域依次确认三项：
   - **固件** — 留空会自动发现工作区里的固件；也可点击手动选择。
   - **串口** — 选择开发板对应的串口（macOS 优先 `/dev/tty.usbserial-*`，Windows 形如 `COM3`）。
   - **复位** — 按你的下载电路选择预设（常见 CH340C 经典电路选 `dtr-low-rts-high`）。
4. 执行 **Flash Latest Firmware**（侧边栏按钮、命令面板，或快捷键 `Cmd/Ctrl + Alt + F`）。
5. 进度、阶段和日志会显示在烧录面板与 Output 中；失败时查看 Troubleshooting 建议。

首次成功后，端口 / 固件 / 复位模式 / 波特率会被记住，之后一键即可重复烧录。

---

## 界面与入口说明

SerialFlash 提供多个互补的操作入口，可按习惯选用。

### 侧边栏（Activity Bar Sidebar）

点击 Activity Bar 的 SerialFlash 图标打开 **Flasher** 视图，分三组：

- **Current** — 当前固件、串口、复位模式（含波特率 / 校验位摘要）。点击任意一项即可重新选择。
- **Actions** — 常用动作快捷入口：Flash Latest Firmware、Open Flasher Panel、Select Project Profile、Show Output、Run Diagnostics。
- **History** — 最近 8 条烧录记录，成功 / 失败带图标，悬停查看时间、端口、地址和字节数。

视图标题栏的刷新按钮可手动刷新状态。

### 烧录面板（Webview Panel）

通过 **Open Flasher Panel** 命令或侧边栏打开，是功能最完整的图形界面：

- 顶部状态条显示当前阶段和进度百分比（空闲 / 烧录中 / 完成 / 失败有不同指示）。
- **烧录目标** 区集中确认固件、串口、复位三项，并提供「诊断」入口。
- **执行** 区是主烧录按钮、进度条、取消，以及「进 Bootloader / 复位运行 / 输出」快捷动作；下方用 pill 显示擦除、校验、运行、关串口、解锁等开关状态。
- 折叠区域可调整 **烧录参数**（波特率、地址、包大小、超时、校验位 + 写入选项）、**硬件复位**（custom 模式下的 DTR/RTS 映射）、**项目与自动化**（profile、项目配置、Tasks）、**维护与危险操作**（校验、擦除、解除读保护、关闭串口、清除记忆）。
- 底部展示最近日志与历史记录；诊断和 Troubleshooting 仅在有内容时出现。
- 烧录运行中会锁定配置和危险动作，只保留取消、输出和诊断。

### 命令面板（Command Palette）

所有命令以 `SerialFlash:` 前缀归类，按 `Cmd/Ctrl + Shift + P` 调用：

| 命令 | 说明 |
| --- | --- |
| `Flash Latest Firmware` | 烧录当前固件（无固件时自动发现 / 选择）。快捷键 `Cmd/Ctrl + Alt + F` |
| `Flash Current File` | 把当前编辑 / 右键的 `.hex`·`.bin` 设为固件并烧录 |
| `Select Firmware` | 从工作区候选中选择固件 |
| `Set as SerialFlash Firmware` | 仅把某文件设为当前固件，不烧录 |
| `Show Firmware Info` | 显示固件格式、大小、base address 等信息 |
| `Select Serial Port` | 选择串口（列表含 manufacturer、SN、VID/PID） |
| `Select Reset Mode` | 选择复位时序预设 |
| `Open Flasher Panel` | 打开图形烧录面板 |
| `Reset To Bootloader` | 仅驱动复位时序进入 Bootloader |
| `Reset And Run` | 复位并运行用户程序 |
| `Cancel Flash` | 取消正在进行的烧录 |
| `Show Output` | 打开 Output Channel 查看完整日志 |
| `Run Diagnostics` | 输出 Extension Host、`serialport` 状态、可见串口 |
| `Erase Chip` | 整片擦除（需确认） |
| `Verify Firmware` | 读回校验当前固件 |
| `Unlock Read Protection` | 解除读保护（会整片擦除，需确认） |
| `Close Port` | 释放仍打开的串口 |
| `Clear Remembered Device` | 清除记住的端口 / 固件 / 复位 / 波特率 |
| `Create Project Config` | 把当前配置写入 `.vscode/settings.json` |
| `Create Tasks` | 生成 `.vscode/tasks.json` 任务 |
| `Create Project Profile` | 把当前配置保存为命名 profile |
| `Select Project Profile` | 在多个 profile 间切换 |
| `Clear Flash History` | 清空烧录历史 |

### 文件右键菜单

在 Explorer 或编辑器标签页右键 `.hex` / `.bin` 文件，可直接 **Flash Current File**、**Verify Firmware**、**Set as SerialFlash Firmware**、**Show Firmware Info**。

### 状态栏

状态栏左侧显示当前端口；烧录中显示阶段和进度，点击可打开面板或输出。

---

## 复位模式与硬件

进入 Bootloader 依赖正确的 DTR/RTS 时序。`serialFlash.resetMode` 可选：

- `dtr-low-rts-high` — CH340C 经典自动下载电路（默认）。
- `ch340x` — CH340X 直连电路。
- `dtr-high-rts-low` — 通用预设（DTR 高复位 / RTS 低进 BOOT）。
- `none` — 不驱动控制线，手动按键进入 Bootloader。
- `custom` — 通过 `serialFlash.customReset.*` 自定义映射。

硬件约定与注意事项：

- 项目内部约定 `true` 为低电平、`false` 为高电平；Node `serialport` 的 modem 线布尔值相反，取反逻辑统一保留在 `src/node-serial-transport.js`。
- CH340C 与 CH340X 电路不要混用预设，时序不同会导致进不去 Bootloader。
- macOS 端口排序优先 `/dev/tty.usbserial-*`，再考虑 `/dev/cu.usbserial-*`。
- STM32 USART Bootloader 默认使用 `115200 8E1`。

电路图、时序记录和排查经验见 [docs/CH340_HARDWARE.md](docs/CH340_HARDWARE.md)；协议包格式见 [docs/STM32_PROTOCOL.md](docs/STM32_PROTOCOL.md)。

---

## 项目配置、Profile 与任务

- **Create Project Config** 把当前配置写入工作区 `.vscode/settings.json`，保留已有 VS Code 设置。
- **Create Project Profile** 把当前配置保存到 `serialFlash.projects`，适合一个工作区有多块板 / 多个固件；**Select Project Profile** 快速切换。
- **Create Tasks** 写入 `.vscode/tasks.json`，生成 flash / bootloader / run 三个任务并保留已有任务。也可手动声明 `serialFlash` 类型任务：

```json
{
  "label": "Flash Latest Firmware",
  "type": "serialFlash",
  "action": "flashLatest"
}
```

`action` 可选 `flashLatest`、`bootloader`、`run`。

> 以上写文件的命令需要先打开一个工作区文件夹。仅修改设置时若没有工作区，会自动写入用户全局设置。

---

## 配置参考

可在工作区或用户设置中配置：

```json
{
  "serialFlash.firmware": "build/Debug/app.hex",
  "serialFlash.port": "/dev/tty.usbserial-10",
  "serialFlash.baudRate": 115200,
  "serialFlash.parity": "even",
  "serialFlash.resetMode": "dtr-low-rts-high",
  "serialFlash.customReset.boot0High": "dtr-false",
  "serialFlash.customReset.boot0Low": "",
  "serialFlash.customReset.resetAssert": "rts-true",
  "serialFlash.flashAddress": "0x08000000",
  "serialFlash.packetSize": 256,
  "serialFlash.timeout": 2000,
  "serialFlash.eraseBeforeWrite": true,
  "serialFlash.verifyAfterWrite": true,
  "serialFlash.runAfterWrite": true,
  "serialFlash.closePortAfterWrite": true,
  "serialFlash.unlockReadProtection": false,
  "serialFlash.autoDiscoverFirmware": true,
  "serialFlash.firmwareGlobs": ["**/*.hex", "**/*.bin"],
  "serialFlash.excludeGlobs": ["**/{node_modules,.git,dist}/**"],
  "serialFlash.projects": [
    {
      "name": "can2rs485",
      "firmware": "CAN2RS485/build/Debug/CAN2RS485.hex",
      "port": "/dev/tty.usbserial-10",
      "resetMode": "ch340x"
    }
  ]
}
```

要点：

- `serialFlash.flashAddress` 未显式配置时，HEX 固件优先使用文件内的 base address，BIN 固件默认 `0x08000000`。
- `serialFlash.firmwareGlobs` / `serialFlash.excludeGlobs` 用于收窄固件扫描范围，避免工作区内多个产物互相干扰。
- `serialFlash.unlockReadProtection` 仅在确认芯片处于读保护状态时开启，它会触发整片擦除。
- 关闭 `serialFlash.closePortAfterWrite` 时，烧录成功后端口保持打开，需要释放时执行 **Close Port**。

---

## 运行环境与边界

- 完整支持 VS Code Desktop 本地 macOS / Windows / Linux。
- Remote SSH / WSL / Dev Container 中只能访问 **Extension Host 实际运行端机器** 上的串口；激活时会提示当前 Extension Host，避免误选本机不存在的串口。
- 不支持 vscode.dev / github.dev 烧录，因为 Web 扩展无法使用 Node `serialport`。
- 同步 Bootloader 时会忽略进入 ACK 前的非 Bootloader 噪声字节，便于处理用户程序的残留输出。

---

## 开发

```bash
npm install
npm test
```

在 VS Code 中打开本仓库，使用 Extension Development Host（F5）调试插件。核心 STM32 UART ISP 逻辑位于 `src/core` 与 `src/stm32.js`，VS Code 集成位于 `src/vscode`。架构与约定见 [AGENTS.md](AGENTS.md)。

### 打包

```bash
npm_config_cache=/private/tmp/npm-cache npx --yes @vscode/vsce package \
  --out /private/tmp/serialflash-stm32.vsix
```

生成的 VSIX 会包含生产依赖 `serialport`。实机验证记录模板见 [docs/HARDWARE_VALIDATION.md](docs/HARDWARE_VALIDATION.md)。

## 许可证

MIT
