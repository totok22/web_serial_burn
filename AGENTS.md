# SerialFlash VS Code 插件分支协作指南

## 项目结构

- `package.json`：VS Code 插件 manifest、命令、菜单和配置项。
- `src/vscode/`：插件入口、命令、配置、串口服务、固件服务、Output Channel 和 Webview。
- `src/vscode/media/`：Webview 面板前端资源。
- `src/core/flash-session.js`：共享 STM32 UART ISP 烧录流程。
- `src/core/reset-timing.js`：DTR/RTS 复位和运行时序。
- `src/core/firmware-discovery.js`：工作区固件候选排序。
- `src/core/node-firmware.js`：Node 侧 `.bin` / Intel HEX 固件加载。
- `src/node-serial-transport.js`：Node `serialport` 适配层。
- `src/stm32.js`：STM32 USART Bootloader 协议。
- `src/firmware.js`：Intel HEX 解析。
- `tests/`：Node 单元测试。
- `README.md`：插件使用说明。
- `docs/STM32_PROTOCOL.md`：STM32 USART Bootloader 协议要点。
- `docs/CH340_HARDWARE.md`：CH340C/CH340X 电路和时序说明。
- `docs/VS_CODE_EXTENSION_PLAN.md`：插件计划与状态。
- `CHANGELOG.md`：变更记录。
- `TODO.md`：本地后续任务（不纳入版本管理）。

## 常用命令

```bash
npm install
npm test
```

插件调试使用 VS Code Extension Development Host。

## 硬件注意事项

- 项目内部约定：`true` 为低电平，`false` 为高电平。
- Node `serialport` 的 modem 线布尔值相反，取反逻辑必须留在 `src/node-serial-transport.js`。
- 经典 CH340C 入口序列已用 `stm32flash -i -rts,-dtr,dtr` 验证。
- CH340X 直连电路已抽象为 `ch340x` 自动时序，仍需硬件实测；不要合并到 CH340C 预设。
- macOS 自动复位优先用 `/dev/tty.usbserial-*`，不要优先用 `/dev/cu.usbserial-*`。
- STM32 USART Bootloader 默认使用 `115200 8E1`。
- 未经硬件验证，不要缩短复位后进入 Bootloader 的等待时间。

## 代码风格

- 使用现代 JavaScript 模块和 2 空格缩进。
- 字节级协议函数保持小而明确。
- `ACK`、`NACK`、`SYNC` 和命令字节集中维护。
- 注释只解释时序、电平、协议边界等非显然内容。
- 修硬件行为时不要顺手做无关重构。

## 测试

- 修改协议、固件解析、传输层、复位时序或插件 core 后运行 `npm test`。
- 优先覆盖包构造、Intel HEX、ACK/NACK、超时、固件发现排序和 STM32 响应解析。
- 硬件流程必须隔离在 transport 适配层之后，便于 Mock。

## 文档

- 同步维护 `README.md`、`CHANGELOG.md`、`docs/CH340_HARDWARE.md`、`docs/STM32_PROTOCOL.md`。
- 文档使用中文。
- 内容要凝练，避免重复背景、营销式表述和未验证结论。
- 硬件变更必须记录板子、端口、固件、VS Code 命令和结果。

## Git 与安全

- 不提交固件二进制、设备日志、`.env*`、`node_modules/`、`dist/`、`build/`。
- 不回滚用户改动，除非用户明确要求。
- commit subject 使用简短祈使句，例如 `Fix CH340 reset timing`。
- 插件只支持 VS Code Desktop 本地烧录；Remote 环境要明确串口属于 Extension Host 所在机器。
