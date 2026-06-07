# SerialFlash 仓库协作指南

## 项目结构

- `index.html`：浏览器入口。
- `src/app.js`：UI 调度、主题/语言切换和浏览器烧写流程。
- `src/serial-transport.js`：Web Serial 传输和 DTR/RTS 复位辅助函数。
- `src/node-serial-transport.js`：CLI 使用的 Node `serialport` 适配层。
- `src/stm32.js`：STM32 USART Bootloader 协议。
- `src/firmware.js`：浏览器端 `.bin` / Intel HEX 加载。
- `src/node-firmware.js`：CLI 固件加载。
- `src/cli.js`：Node CLI 烧写入口。
- `tests/`：Node 测试。
- `README.md`：使用说明。
- `docs/STM32_PROTOCOL.md`：STM32 USART Bootloader 协议要点。
- `docs/CH340_HARDWARE.md`：CH340C/CH340X 电路和时序说明。
- `CHANGELOG.md`：变更记录。
- `TODO.md`：本地后续任务（不纳入版本管理）。
- `start.command` / `start.bat`：macOS / Windows 本地服务启动脚本。

## 常用命令

```bash
npm install
npm test
node src/cli.js --help
python3 -m http.server 8080
```

macOS 本地双击启动：

```text
start.command
```

Windows 本地双击启动：

```text
start.bat
```

已验证 CH340C CLI 命令：

```bash
node src/cli.js \
  --port /dev/tty.usbserial-10 \
  --file /Users/poli/STM32CubeIDE/workspace_2.1.1/PDM/Debug/PDM.hex \
  --reset dtr-low-rts-high \
  --timeout 3000 \
  --unlock
```

## 硬件注意事项

- 项目内部约定：`true` 为低电平，`false` 为高电平。
- Node `serialport` 的 modem 线布尔值相反，取反逻辑必须留在 `src/node-serial-transport.js`。
- 经典 CH340C 入口序列已用 `stm32flash -i -rts,-dtr,dtr` 验证。
- CH340X 直连电路已抽象为 `ch340x` 自动时序，仍需硬件实测；不要合并到 CH340C 预设。
- macOS CLI 自动复位优先用 `/dev/tty.usbserial-*`，不要优先用 `/dev/cu.usbserial-*`。
- STM32 USART Bootloader 默认使用 `115200 8E1`。
- 未经硬件验证，不要缩短复位后进入 Bootloader 的等待时间。

## 代码风格

- 使用现代 JavaScript 模块和 2 空格缩进。
- 字节级协议函数保持小而明确。
- `ACK`、`NACK`、`SYNC` 和命令字节集中维护。
- 注释只解释时序、电平、协议边界等非显然内容。
- 修硬件行为时不要顺手做无关重构。

## 测试

- 修改协议、固件解析或传输层后运行 `npm test`。
- 优先覆盖包构造、Intel HEX、ACK/NACK、超时和 STM32 响应解析。
- 硬件流程必须隔离在 transport 适配层之后，便于 Mock。

## 文档

- 同步维护 `README.md`、`CHANGELOG.md`、`docs/CH340_HARDWARE.md`、`docs/STM32_PROTOCOL.md`。
- 文档使用中文。
- 内容要凝练，避免重复背景、营销式表述和未验证结论。
- 硬件变更必须记录板子、端口、固件、命令和结果。

## Git 与安全

- 不提交固件二进制、设备日志、`.env*`、`node_modules/`、`dist/`、`build/`。
- 不回滚用户改动，除非用户明确要求。
- commit subject 使用简短祈使句，例如 `Fix CH340 reset timing`。
- Web Serial 必须由用户点击触发 `navigator.serial.requestPort()`，且需要 HTTPS 或 localhost。
