# 变更记录

## 未发布

- 增加 Intel HEX 解析，包含校验和、EOF、地址和记录长度校验。
- 增加 Node.js CLI 烧写入口。
- 增加 macOS `start.command`，用于双击启动本地服务。
- 增加 Windows `start.bat`，用于双击启动本地服务。
- 增加基于 `serialport` 的 Node 串口适配层。
- 修复 STM32 GET 命令解析：payload 长度为 `N + 1`，随后才是最终 ACK。
- 修复 CH340C 经典电路的 CLI DTR/RTS 入口时序。
- 增加 Node `serialport` DTR/RTS 电平取反适配。
- 增加进入 Bootloader 后的稳定等待时间。
- 增加 Intel HEX 和 STM32 包格式测试。
- 记录 macOS CH340 优先使用 `/dev/tty.usbserial-*`。
- 增加 CH340C 和 CH340X 硬件说明。
- 增加并实测 `ch340x` 直连电路自动时序预设。
- 将 STM32 全片擦除等待时间放宽到 60 秒，兼容擦除较慢的芯片。
- 增加 STM32 `GO` 命令支持，用于烧写后跳转运行。
- 增加常见 DTR/RTS 复位组合预设。
- 将通用 DTR/RTS 复位组合改为 FlyMcu 风格的“复位/进 Bootloader”描述。
- 增加烧写完成后关闭串口选项，避免控制线持续影响目标板运行。
- 增加 CH340C/CH340X 电路图片和排查经验记录。
- 增加 LICENSE、CONTRIBUTING 和项目元信息。
- 将原实现计划中的协议要点整理为 `docs/STM32_PROTOCOL.md`。

## 验证记录

- macOS + CH340C 经典电路。
- STM32F10xxx Medium-density，PID `0x0410`。
- Bootloader 版本 `0x22`。
- 固件 `/Users/poli/STM32CubeIDE/workspace_2.1.1/PDM/Debug/PDM.hex`。
- CLI 擦除、写入、校验完成。
- macOS + CH340X 直连电路 CAN2RS485 板。
- STM32 PID `0x0413`。
- Bootloader 版本 `0x31`。
- 固件 `/Users/poli/STM32CubeIDE/workspace_2.1.1/CAN2RS485/build/Debug/CAN2RS485.hex`。
- CLI 擦除、写入、校验完成。
