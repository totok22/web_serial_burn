# 变更记录

## 0.2.0

### VS Code 插件

- 将分支收敛为 `STM32 Serial Flasher` VS Code 本地插件。
- 增加命令面板、右键菜单、Quick Pick、Output Channel、状态栏和 Webview 烧录面板入口。
- 增加 Activity Bar Sidebar，显示当前配置、常用动作和最近烧录历史。
- 增加擦除、校验、解除读保护、清除记忆、创建项目配置、清空历史命令。
- 增加 `Close Port` 命令，并保证烧录失败时即使关闭自动关端口选项也会释放串口。
- 增加 `Cancel Flash` 命令和 Webview 入口。
- 增加 `custom` 复位模式及 DTR/RTS 自定义映射配置。
- 增加可配置固件发现 globs/excludes。
- 增加 `Show Firmware Info` 命令和右键菜单入口。
- 增加 `Run Diagnostics` 命令、侧边栏和 Webview 入口，用于输出 Extension Host、`serialport` 和串口枚举状态。
- 串口选择和诊断输出保留 serial number 与 VID/PID，便于多设备排查。
- 状态栏在插件激活时会显示已记住的串口。
- `.hex` / `.bin` 右键菜单增加直接校验入口。
- 固件 Quick Pick 增加格式、大小和 HEX base address 摘要。
- 失败日志增加串口占用、权限、Bootloader ACK 超时、NACK 和校验失败等排查建议。
- `Create Project Config` 支持合并带注释的 VS Code `settings.json`，并写入固件发现 globs/excludes。
- `Create Tasks` 支持合并带注释的 VS Code `tasks.json`，并保留已有任务。
- Remote / WSL / Dev Container 环境激活时提示串口归属 Extension Host，并引导运行 Diagnostics。
- Webview 面板运行中会锁定配置和危险动作，只保留 Cancel、Output 和 Diagnostics。
- Webview 面板显示失败排查建议，并在新一轮烧录开始或成功后清理旧错误状态。
- 切换项目 profile 或在 Webview 修改端口后，状态栏会同步当前端口。
- 增加多项目 profile：可保存和切换 `serialFlash.projects`。
- 增加 `serialFlash` VS Code Task Provider。
- 增加 `Create Tasks` 命令，可生成 `.vscode/tasks.json`。
- 增加工作区固件自动发现、排序和上次成功配置记忆。
- Webview 面板支持编辑主要烧录配置、显示最近日志和历史记录。
- 更新插件 Marketplace 图标和 Activity Bar 图标为新的灰色微芯片样式。
- Activity Bar 图标改用 `currentColor`，可随主题在激活/未激活状态下自适应配色。
- 将 STM32 UART ISP 烧录流程抽为 `flashStm32Uart()`，供插件命令统一调用。
- 共享烧录流程支持忽略 Bootloader ACK 前的串口噪声字节。
- 将 DTR/RTS 复位时序抽到 `src/core/reset-timing.js`。
- 增加 manifest、扩展激活、打包和临时 VS Code 安装验证。

### 清理

- 删除旧浏览器 Web Serial 页面、样式、字体和双击启动脚本。
- 删除 CLI 入口，当前分支只保留 VS Code 插件需要的 Node 串口适配、固件解析、协议和 core。

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
