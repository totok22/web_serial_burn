# SerialFlash VS Code 本地插件计划

## 目标

在新分支中规划一个 **VS Code 本地插件版 SerialFlash**。

设计重点不是复刻当前网页界面，而是做成更符合 VS Code 使用习惯的快速烧录工具：

- 自动发现工作区内的 `.hex` / `.bin` 固件。
- 记住上次端口、固件、复位模式、烧录选项。
- 支持一键烧录当前固件。
- 支持命令面板、右键菜单、Quick Pick、Output Channel。
- 后续提供 Webview Panel 作为完整图形化面板。
- 插件主体运行在本地 VS Code Extension Host，通过 Node `serialport` 访问本机串口。

## 总体结论

可行，且建议路线为：

```text
MVP：
Command Palette + Quick Pick + 自动固件发现 + Output Channel + 一键烧录

增强版：
Webview Panel 完整图形界面 + 状态栏 + 右键菜单 + 配置记忆

专业版：
Sidebar View + 固件历史 + 多项目配置 + 自定义任务集成
```

第一版不要一上来做很重的 Webview。先把烧录链路、配置记忆和自动发现固件做稳，再用 Webview 做更舒服的集中面板。

## 运行边界

本计划只把 **VS Code Desktop 本地插件** 作为完整烧录目标。

| 运行环境 | 支持程度 | 说明 |
| --- | --- | --- |
| VS Code Desktop 本地 macOS / Windows / Linux | 完整支持 | 使用 Node `serialport` 访问本机串口 |
| VS Code Remote SSH / WSL / Dev Container | 受限支持 | 只能访问插件实际运行端机器上的串口，容易和用户本机 USB 混淆 |
| vscode.dev / github.dev | 不作为烧录目标 | Web 扩展没有 Node API，不能使用 `serialport` |

插件 `package.json` 建议：

```json
{
  "main": "./dist/extension.js",
  "extensionKind": ["ui", "workspace"]
}
```

优先 `ui` 是为了让插件尽量运行在本地 UI 扩展宿主，访问用户插在电脑上的 USB 串口。

## 产品设计

### 插件命名

候选名称：

- `STM32 Serial Flasher`
- `STM32 UART ISP`
- `STM32 Bootloader Flasher`
- `SerialFlash STM32`
- `STM32 ISP Flash Tool`

推荐优先使用 `STM32 Serial Flasher`。

理由：

- 用户一眼能看懂用途：给 STM32 通过串口烧录。
- 比 `STM32 UART ISP` 更适合普通用户搜索和理解。
- 比 `STM32 Bootloader Flasher` 更短，且不容易被误解为烧录 Bootloader 本身。
- 比 `SerialFlash STM32` 更明确体现 STM32 是主对象。
- 比 `STM32 ISP Flash Tool` 更自然，Marketplace 展示也更像产品名。

技术标识可以继续使用 `serialflash-stm32`，命令前缀使用 `SerialFlash` 或 `STM32 Serial Flasher`。

### 核心用户路径

典型使用方式应该非常短：

1. 用户打开一个包含固件的 VS Code 工作区。
2. 执行 `SerialFlash: Flash Latest Firmware`。
3. 插件自动扫描工作区，找出最可能的 `.hex` / `.bin`。
4. 若只有一个候选固件，自动选中；若多个，用 Quick Pick 展示。
5. 插件优先使用上次成功端口；端口不可用时弹出 Quick Pick。
6. 插件使用上次成功配置烧录。
7. Output Channel 显示日志，状态栏显示进度。

目标是让高频烧录变成：

```text
Cmd/Ctrl+Shift+P -> SerialFlash: Flash Latest Firmware -> Enter
```

或者直接绑定快捷键后：

```text
按一次快捷键 -> 自动烧录
```

### 命令面板

第一版命令：

- `SerialFlash: Flash Latest Firmware`
  - 自动发现固件并烧录，是主入口。
- `SerialFlash: Flash Current File`
  - 当前编辑器文件是 `.hex` / `.bin` 时直接烧录。
- `SerialFlash: Select Firmware`
  - 从工作区候选固件中选择并记住。
- `SerialFlash: Select Serial Port`
  - 枚举串口并记住。
- `SerialFlash: Select Reset Mode`
  - 选择 CH340C、CH340X、手动、none 或自定义。
- `SerialFlash: Open Flasher Panel`
  - 打开 Webview 完整面板。
- `SerialFlash: Reset To Bootloader`
  - 只执行 DTR/RTS 进 Bootloader。
- `SerialFlash: Reset And Run`
  - 复位运行用户程序。
- `SerialFlash: Show Output`
  - 打开日志。

后续命令：

- `SerialFlash: Erase Chip`
- `SerialFlash: Verify Firmware`
- `SerialFlash: Unlock Read Protection`
- `SerialFlash: Clear Remembered Device`
- `SerialFlash: Create Project Config`

### Quick Pick

Quick Pick 是 MVP 的主要交互方式。

端口选择示例：

```text
Select serial port
> /dev/tty.usbserial-10    USB Serial CH340    last used
> /dev/cu.usbserial-10     USB Serial CH340
> COM3                     USB-SERIAL CH340
```

固件选择示例：

```text
Select firmware
> build/Debug/CAN2RS485.hex          latest, 64 KB
> Debug/PDM.hex                      48 KB
> firmware.bin                       32 KB
```

复位模式选择示例：

```text
Select reset mode
> CH340C 经典电路              last used
> CH340X 直连电路
> 手动 BOOT0/RESET
> 不使用控制线
> 自定义 DTR/RTS 映射
```

### Output Channel

Output Channel 是第一版主要日志界面。

示例：

```text
[SerialFlash] Firmware: build/Debug/CAN2RS485.hex, HEX, 65536 bytes
[SerialFlash] Port: /dev/tty.usbserial-10 @ 115200 8E1
[SerialFlash] Reset: CH340X direct
[SerialFlash] Entering bootloader...
[SerialFlash] Bootloader 0x31, PID 0x0413
[SerialFlash] Erase complete (extended)
[SerialFlash] Write 65536 bytes complete
[SerialFlash] Verify complete
[SerialFlash] Reset and run
[SerialFlash] Done
```

要求：

- 日志必须可复制。
- 错误要直接说明下一步排查方向。
- 读保护解除必须明确提示会擦除全片。
- 烧录失败后必须执行 `finally close`，避免串口占用。

### 状态栏

状态栏只放短状态，不堆按钮。

建议格式：

```text
SerialFlash: /dev/tty.usbserial-10
SerialFlash: Flashing 72%
SerialFlash: Done
SerialFlash: Error
```

点击状态栏：

- 空闲时打开 `Open Flasher Panel`。
- 烧录失败时打开 Output Channel。

### 右键菜单

在 Explorer 和编辑器 tab 中，对 `.hex` / `.bin` 提供：

- `Flash with SerialFlash`
- `Set as SerialFlash Firmware`

后续可加：

- `Verify with SerialFlash`
- `Show Firmware Info`

### Webview Panel

Webview Panel 作为增强版，不作为 MVP 阻塞项。

它是 VS Code 内部的网页式面板，不是外部浏览器窗口。界面可以自由设计，但硬件访问仍由插件 Node 侧执行：

```text
Webview UI -> postMessage -> extension host -> serialport/core -> postMessage -> Webview UI
```

Webview 不直接调用串口，不直接访问 VS Code API。

面板建议聚焦完整可视化工作流：

```text
┌───────────────────────────────────────────────┐
│ SerialFlash                                    │
├───────────────────────────────────────────────┤
│ Firmware  build/Debug/CAN2RS485.hex   [Change] │
│ Port      /dev/tty.usbserial-10       [Change] │
│ Reset     CH340X direct               [Change] │
│ Baud      115200  8E1                          │
│ Address   0x08000000                           │
│ Options   [x] erase [x] verify [x] run          │
│                                               │
│ [Flash] [Bootloader] [Run] [Open Output]       │
│                                               │
│ Progress  ███████████░░░░ 72%                  │
│ Log       Sync OK, writing page 32/128         │
└───────────────────────────────────────────────┘
```

设计原则：

- 首页就是烧录工具，不做介绍页。
- 默认显示最少必要项，高级配置折叠。
- 主按钮只有一个 `Flash`，其他动作降级为次按钮。
- 面板读取和写入 VS Code 设置，与命令面板共享配置。
- 面板关闭不应中断正在运行的烧录任务，除非用户点取消。

### Sidebar View

不是第一优先级。

适合后续显示：

- 当前设备。
- 当前固件。
- 最近烧录记录。
- 常用动作。

若加入，保持小而克制，不复制完整 Webview Panel。

## 自动发现固件

这是本地插件的关键便利化能力。

### 扫描范围

默认扫描工作区：

- `**/*.hex`
- `**/*.bin`

默认排除：

- `**/node_modules/**`
- `**/.git/**`
- `**/dist/**`
- `**/build/**` 不应全排除，因为嵌入式固件常在 build 下；只排除明显 Web 产物可配置。

推荐内置优先目录：

- `build/`
- `Debug/`
- `Release/`
- `cmake-build-*/`
- `STM32CubeIDE` 常见输出目录。

### 排序策略

候选固件按分数排序：

1. 最近修改时间越新越高。
2. 文件扩展名 `.hex` 优先于 `.bin`，因为 HEX 自带地址。
3. 路径包含 `Debug` / `Release` / `build` 加分。
4. 文件名包含当前工作区名或项目名加分。
5. 上次成功烧录的路径加分。
6. 文件过小或明显不是固件的 `.bin` 降分。

如果最高分唯一且明显高于第二名，可自动选择；否则弹 Quick Pick。

### 固件信息展示

选择时展示：

- 相对路径。
- 修改时间。
- 文件大小。
- 格式。
- HEX base address。

示例：

```text
build/Debug/CAN2RS485.hex
HEX / 64 KB / base 0x08000000 / modified 2 min ago
```

## 记忆功能

插件应记住两类状态。

### Workspace 级记忆

存到 `.vscode/settings.json` 或 VS Code workspace state。

适合：

- 固件路径。
- flash address。
- reset mode。
- baud rate。
- parity。
- packet size。
- erase / verify / run / close 选项。

如果用户选择“创建项目配置”，可写入：

```json
{
  "serialFlash.firmware": "build/Debug/CAN2RS485.hex",
  "serialFlash.port": "/dev/tty.usbserial-10",
  "serialFlash.baudRate": 115200,
  "serialFlash.parity": "even",
  "serialFlash.resetMode": "ch340x",
  "serialFlash.flashAddress": "0x08000000",
  "serialFlash.eraseBeforeWrite": true,
  "serialFlash.verifyAfterWrite": true,
  "serialFlash.runAfterWrite": true,
  "serialFlash.closePortAfterWrite": true
}
```

### Global 级记忆

存到 VS Code global state。

适合：

- 最近成功端口。
- 最近使用的 reset mode。
- 最近使用的 baud rate。
- 是否显示高级确认。

端口记忆要允许失效：

- 上次端口存在时直接复用。
- 不存在时自动弹端口选择。
- macOS 上优先 `/dev/tty.usbserial-*`，不要优先 `/dev/cu.usbserial-*`。

## 一键烧录策略

`Flash Latest Firmware` 的行为：

1. 获取配置。
2. 自动发现固件。
3. 自动选择或 Quick Pick 选择固件。
4. 枚举串口。
5. 优先使用上次端口。
6. 若端口不可用，Quick Pick 选择端口。
7. 打开 Output Channel。
8. 执行完整烧录：
   - 打开串口。
   - DTR/RTS 进入 Bootloader。
   - 同步并读取 Bootloader 版本和 PID。
   - 擦除。
   - 写入。
   - 校验。
   - 运行。
   - 按设置关闭串口。
9. 成功后记住固件、端口和配置。

失败时：

- 不覆盖“上次成功配置”。
- 记录失败原因。
- 提供下一步按钮：
  - `Select Port`
  - `Select Reset Mode`
  - `Open Output`

## 技术架构

### 推荐目录

第一阶段可以保持单仓库，新增插件目录：

```text
src/
  core/
    flash-session.js
    reset-timing.js
    firmware-discovery.js
  vscode/
    extension.js
    commands.js
    serial-service.js
    firmware-service.js
    settings.js
    output.js
    panel.js
    media/
      panel.html
      panel.js
      panel.css
```

后续如果插件体量变大，再拆成 packages：

```text
packages/core
packages/cli
packages/vscode
```

### Core 层

从现有代码抽出：

- `src/stm32.js`
- `src/firmware.js`
- `src/node-firmware.js`
- `src/serial-transport.js` 中的复位时序。
- `src/cli.js` 中的完整烧录流程。

建议新增：

```js
export async function flashStm32Uart({
  transport,
  firmware,
  address,
  packetSize,
  timeout,
  resetMode,
  erase,
  verify,
  run,
  unlock,
  onLog,
  onProgress,
  signal,
}) {
  // shared CLI / VS Code / Web flow
}
```

这样 CLI 和 VS Code 插件共用同一套流程。

### VS Code 后端

职责：

- 注册命令。
- 枚举串口。
- 选择固件。
- 读取和写入配置。
- 创建 `NodeSerialTransport`。
- 调用 `flashStm32Uart()`。
- 输出日志。
- 更新状态栏。
- 和 Webview 通信。

### Webview

职责：

- 展示当前配置。
- 触发命令。
- 显示日志和进度。

不负责：

- 直接读写串口。
- 直接读写本地文件。
- 保存插件配置。

## 现有代码改造

### 必做

- 把 CLI 烧录流程抽成 `flashStm32Uart()`。
- 把 `syncBootloaderIgnoringNoise()` 从 `src/app.js` 抽到共享 core。
- 把复位时序从 Web Serial transport 中拆出为纯函数/共享模块。
- 保留 `NodeSerialTransport` 的 DTR/RTS 取反逻辑。
- 新增固件扫描和排序模块。
- 新增配置读取/记忆模块。

### 暂不做

- 不重写 STM32 协议。
- 不扩展其他 MCU 协议。
- 不把当前 Web UI 原样搬进 Webview。
- 不承诺 vscode.dev 上直接烧写硬件。

## 配置项

建议插件贡献配置：

```json
{
  "serialFlash.firmware": "",
  "serialFlash.port": "",
  "serialFlash.baudRate": 115200,
  "serialFlash.parity": "even",
  "serialFlash.resetMode": "dtr-low-rts-high",
  "serialFlash.flashAddress": "0x08000000",
  "serialFlash.packetSize": 256,
  "serialFlash.timeoutMs": 2000,
  "serialFlash.eraseBeforeWrite": true,
  "serialFlash.verifyAfterWrite": true,
  "serialFlash.runAfterWrite": true,
  "serialFlash.closePortAfterWrite": true,
  "serialFlash.unlockOnReadProtection": false,
  "serialFlash.autoDiscoverFirmware": true,
  "serialFlash.firmwareGlobs": [
    "**/*.hex",
    "**/*.bin"
  ],
  "serialFlash.excludeGlobs": [
    "**/.git/**",
    "**/node_modules/**"
  ],
  "serialFlash.preferTtyUsbserialOnMac": true
}
```

## MVP 实施计划

### 阶段 1：建立分支和规划文档

当前分支：

```text
vscode-local-extension-plan
```

交付：

- 本计划文档。
- 不改动现有烧录功能。

### 阶段 2：抽共享烧录流程

任务：

- 新增 `src/core/flash-session.js`。
- 迁移 CLI 主流程。
- CLI 改为调用 `flashStm32Uart()`。
- 补 mock transport 测试。

验收：

- `npm test` 通过。
- `node src/cli.js --help` 正常。
- 现有 CLI 实机命令仍可烧写。

### 阶段 3：插件骨架

任务：

- 新增 VS Code 插件入口。
- 配置 `package.json` 的 commands / menus / configuration。
- 实现 Output Channel。
- 实现状态栏。
- 实现命令注册。

验收：

- Extension Development Host 可启动。
- 命令面板能看到 SerialFlash 命令。
- Output Channel 可打开。

### 阶段 4：自动发现固件

任务：

- 新增 `firmware-discovery.js`。
- 支持 workspace scan。
- 实现候选排序。
- 实现 Quick Pick 选择。
- 记住选择结果。

验收：

- 工作区内多个 `.hex` / `.bin` 时能按合理顺序展示。
- 当前编辑器是固件文件时优先使用当前文件。
- 上次选择能被记住。

### 阶段 5：串口选择和记忆

任务：

- 接入 `serialport.list()`。
- macOS 优先 `/dev/tty.usbserial-*`。
- Quick Pick 展示端口路径、manufacturer、serial number。
- 记住上次成功端口。

验收：

- macOS / Windows 至少能列出端口。
- 上次端口不存在时自动重新选择。

### 阶段 6：一键烧录

任务：

- 实现 `Flash Latest Firmware`。
- 实现 `Flash Current File`。
- 接入 `NodeSerialTransport`。
- 接入 `flashStm32Uart()`。
- 日志写 Output Channel。
- 进度写状态栏。
- 成功后记住配置。

验收：

- CH340C 经典电路可烧写。
- CH340X 直连电路可烧写。
- 失败后串口释放。
- 成功后下一次可一键复用配置。

### 阶段 7：Webview Panel

任务：

- 新增 `Open Flasher Panel`。
- 实现配置查看和修改。
- 实现 `Flash` 主按钮。
- 实现日志和进度展示。
- 通过 message passing 调用扩展后端。

验收：

- 面板能反映当前 workspace/global 配置。
- 面板烧录和命令面板烧录走同一套后端。
- 面板关闭不破坏正在执行的烧录任务。

### 阶段 8：右键菜单和 polish

任务：

- `.hex` / `.bin` 右键菜单。
- `Set as SerialFlash Firmware`。
- 错误提示优化。
- README 插件使用说明。
- CHANGELOG。

验收：

- 右键固件可直接烧录。
- 新用户可以不打开面板完成一次烧录。

## 测试计划

### 单元测试

- STM32 协议包构造。
- Intel HEX 解析。
- reset timing。
- flash session 流程。
- firmware discovery 排序。
- settings fallback。

### 插件测试

- 命令注册。
- Quick Pick 输入输出。
- Output Channel 日志。
- 状态栏状态。
- 右键菜单条件。
- Webview message protocol。

### 硬件测试

每次记录：

- 日期。
- OS。
- VS Code 版本。
- 插件版本。
- 串口芯片。
- 端口。
- 固件路径。
- reset mode。
- baud/parity/timeout。
- Bootloader version。
- PID。
- erase/write/verify/run 结果。

必须覆盖：

- macOS + CH340C。
- macOS + CH340X。
- Windows + CH340。
- Linux + `/dev/ttyUSB*` 或 `/dev/ttyACM*`。

## 风险

| 风险 | 对策 |
| --- | --- |
| `serialport` 原生依赖在 VSIX 中加载失败 | 先本地开发验证，再做各平台 VSIX 安装测试 |
| Remote 模式访问到远端串口 | 插件优先 `ui`，并显示当前运行宿主 |
| 自动发现选错固件 | 有分数排序和 Quick Pick 确认；成功后再记忆 |
| 上次端口失效 | 自动重新枚举并提示选择 |
| 读保护解除误擦除 | 默认关闭或二次确认 |
| Webview 过重影响开发进度 | MVP 不依赖 Webview |
| DTR/RTS 极性差异 | 保留 CH340C/CH340X 独立预设和自定义模式 |

## 推荐下一步

下一步应从阶段 2 开始：抽出 `flashStm32Uart()`，让 CLI 和未来 VS Code 插件共用同一条烧录链路。

完成这个抽离后，再搭插件骨架会更稳，因为 VS Code 命令只是新的调用入口，不会重新实现一套烧写逻辑。
