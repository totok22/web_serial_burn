# STM32 Serial Flasher

SerialFlash 的 VS Code 本地插件版，用于通过 STM32 USART Bootloader 和本机串口烧录 `.hex` / `.bin` 固件。

## 功能

- 自动扫描工作区中的 `.hex` / `.bin` 固件，并按修改时间、路径和格式排序。
- 固件选择列表会显示格式、大小和 HEX base address。
- 记住上次成功端口、固件、复位模式和波特率。
- 支持命令面板、固件右键菜单、Quick Pick、Output Channel 和状态栏。
- 提供 VS Code Webview 烧录面板和 Activity Bar Sidebar。
- 记录最近烧录历史，支持生成 `.vscode/settings.json` 项目配置。
- 提供 `serialFlash` 自定义任务，便于在 VS Code Tasks 中触发常用烧录动作。
- 硬件访问始终由 Extension Host 中的 Node `serialport` 执行。
- 复用同一套 STM32 UART ISP core：进入 Bootloader、擦除、写入、校验、复位运行。
- 同步 Bootloader 时会忽略进入 ACK 前的非 Bootloader 噪声字节，便于处理用户程序残留输出。
- 失败时会在 Output 中输出针对超时、NACK、串口占用、权限和校验失败的排查建议。

## 运行边界

- 完整支持 VS Code Desktop 本地 macOS / Windows / Linux。
- Remote SSH / WSL / Dev Container 只能访问插件实际运行端机器上的串口。
- 在 Remote SSH / WSL / Dev Container 中激活时会提示当前 Extension Host，避免误选用户本机不存在的串口。
- 不支持 vscode.dev / github.dev 烧录，因为 Web 扩展不能使用 Node `serialport`。

## 常用命令

- `SerialFlash: Flash Latest Firmware`
- `SerialFlash: Flash Current File`
- `SerialFlash: Select Firmware`
- `SerialFlash: Show Firmware Info`
- `SerialFlash: Select Serial Port`
- `SerialFlash: Select Reset Mode`
- `SerialFlash: Open Flasher Panel`
- `SerialFlash: Reset To Bootloader`
- `SerialFlash: Reset And Run`
- `SerialFlash: Cancel Flash`
- `SerialFlash: Show Output`
- `SerialFlash: Run Diagnostics`
- `SerialFlash: Erase Chip`
- `SerialFlash: Verify Firmware`
- `SerialFlash: Unlock Read Protection`
- `SerialFlash: Clear Remembered Device`
- `SerialFlash: Close Port`
- `SerialFlash: Create Project Config`
- `SerialFlash: Create Tasks`
- `SerialFlash: Create Project Profile`
- `SerialFlash: Select Project Profile`
- `SerialFlash: Clear Flash History`

Explorer 和编辑器 tab 右键菜单会对 `.hex` / `.bin` 显示烧录、校验、设为固件和固件信息入口。

## 面板、侧边栏和任务

- `SerialFlash: Open Flasher Panel` 打开完整烧录面板，可修改 baud、address、packet、timeout、parity 和烧录选项。
- 烧录运行中，面板会锁定配置和危险动作，只保留 Cancel、Output 和 Diagnostics。
- 烧录失败后，面板会显示 Troubleshooting 建议，并可直接打开 Output 查看完整日志。
- Activity Bar 中的 SerialFlash Sidebar 显示当前固件、端口、复位模式、常用动作和最近烧录记录。
- `SerialFlash: Run Diagnostics` 会输出 Extension Host、`serialport` 加载状态和当前可见串口，便于排查 Remote/原生依赖问题。
- 串口选择和诊断会显示 manufacturer、serial number、VID/PID，便于区分多块 CH340/USB-UART。
- `SerialFlash: Create Project Config` 会把当前配置写入工作区 `.vscode/settings.json`，并保留已有 VS Code 设置。
- `SerialFlash: Create Tasks` 会写入 `.vscode/tasks.json`，生成 flash / bootloader / run 三个任务，并保留已有任务。
- `SerialFlash: Create Project Profile` 会把当前配置保存到 `serialFlash.projects`，适合一个工作区有多个固件/板卡。
- `SerialFlash: Select Project Profile` 可在多个项目配置间快速切换。
- 如果关闭 `serialFlash.closePortAfterWrite`，烧录成功后端口会保持打开；需要释放时执行 `SerialFlash: Close Port`。
- `serialFlash.resetMode` 可设为 `custom`，并通过 `serialFlash.customReset.boot0High`、`serialFlash.customReset.boot0Low`、`serialFlash.customReset.resetAssert` 配置 DTR/RTS 映射。
- VS Code Tasks 支持 `serialFlash` 类型：

```json
{
  "label": "Flash Latest Firmware",
  "type": "serialFlash",
  "action": "flashLatest"
}
```

`action` 可选 `flashLatest`、`bootloader`、`run`。

## 配置

可在工作区设置中配置：

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

`serialFlash.flashAddress` 未显式配置时，HEX 固件会优先使用文件内的 base address；BIN 固件默认使用 `0x08000000`。
可用 `serialFlash.firmwareGlobs` / `serialFlash.excludeGlobs` 收窄固件扫描范围，避免工作区内多个产物互相干扰。

## 硬件注意事项

- 项目内部约定：`true` 为低电平，`false` 为高电平。
- Node `serialport` 的 modem 线布尔值相反，取反逻辑保留在 `src/node-serial-transport.js`。
- macOS 端口排序优先 `/dev/tty.usbserial-*`，再考虑 `/dev/cu.usbserial-*`。
- STM32 USART Bootloader 默认使用 `115200 8E1`。

硬件电路、时序记录和排查经验见 [docs/CH340_HARDWARE.md](docs/CH340_HARDWARE.md)。
协议包格式见 [docs/STM32_PROTOCOL.md](docs/STM32_PROTOCOL.md)。
插件实机验证记录模板见 [docs/HARDWARE_VALIDATION.md](docs/HARDWARE_VALIDATION.md)。

## 开发

```bash
npm install
npm test
```

在 VS Code 中打开本仓库后，使用 Extension Development Host 调试本插件。

## 打包验证

```bash
npm_config_cache=/private/tmp/npm-cache npx --yes @vscode/vsce package \
  --out /private/tmp/serialflash-stm32.vsix
```

VSIX 会包含生产依赖 `serialport`。
