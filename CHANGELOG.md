# 变更记录

## v0.1.0 - 2026-06-07

首个公开版本。

### 界面

- UI 大改版并更名为 SerialFlash：琥珀色主题、自定义标题字体、间距与布局重新打磨。
- 增加明暗主题切换和中英文切换。
- 主题切换改为整页统一过渡，避免局部闪烁。
- 对齐执行日志面板与烧写设置面板的内容顶部。
- 修复页脚样式、信息图标，移除图片灯箱。
- 修复电路说明对话框按钮无法打开。
- 将串口入口合并为“选择并开启串口”，移除冗余的“开启串口”按钮。

### 烧写与协议

- 增加 STM32 UART ISP 自动进 Bootloader、擦除、写入、校验和运行流程。
- 增加 Intel HEX 解析，包含校验和、EOF、地址和记录长度校验。
- 修复 STM32 GET 命令解析：payload 长度为 `N + 1`，随后才是最终 ACK。
- 增加 STM32 `GO` 命令支持，用于烧写后跳转运行。
- 将 STM32 全片擦除等待时间放宽到 60 秒，兼容擦除较慢的芯片。
- 增加进入 Bootloader 后的稳定等待时间。
- 增加烧写完成后关闭串口选项，避免控制线持续影响目标板运行。

### 硬件预设

- 内置 CH340C 经典电路、CH340X 直连电路和常见 DTR/RTS 组合预设。
- 增加并实测 `ch340x` 直连电路自动时序预设。
- 修复 CH340C 经典电路的 CLI DTR/RTS 入口时序。
- 增加 Node `serialport` DTR/RTS 电平取反适配。
- 将通用 DTR/RTS 复位组合改为 FlyMcu 风格的“复位/进 Bootloader”描述。
- 记录 macOS CH340 优先使用 `/dev/tty.usbserial-*`。

### CLI 与启动

- 增加 Node.js CLI 烧写入口和基于 `serialport` 的 Node 串口适配层。
- 增加 macOS `start.command` 和 Windows `start.bat`，用于双击启动本地服务。

### 文档与测试

- 增加 Intel HEX 和 STM32 包格式测试。
- 增加 CH340C 和 CH340X 硬件说明。
- 增加 CH340C/CH340X 电路图片和排查经验记录。
- 将原实现计划中的协议要点整理为 `docs/STM32_PROTOCOL.md`。
- 增加 LICENSE、CONTRIBUTING 和项目元信息。

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
