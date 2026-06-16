# VS Code 插件硬件验证记录模板

每次实机验证都按此模板记录，避免只留下“能烧”的口头结论。

## 环境

- 日期：
- OS：
- VS Code 版本：
- 插件版本：
- 运行环境：VS Code Desktop 本地 / Remote SSH / WSL / Dev Container
- 串口芯片：
- 端口：
- 板卡：
- MCU：
- 固件路径：
- 固件格式：HEX / BIN
- reset mode：
- custom reset mapping（如适用）：
- baud/parity/timeout：
- flash address：
- erase / verify / run / close：

## 操作

1. 打开包含固件的工作区。
2. 执行 `SerialFlash: Select Serial Port`。
3. 执行 `SerialFlash: Select Reset Mode`。
4. 执行 `SerialFlash: Flash Latest Firmware` 或在面板点击 `Flash`。
5. 保存 Output Channel 日志中的关键信息。

## 结果

- Bootloader version：
- PID：
- 擦除结果：
- 写入结果：
- 校验结果：
- 运行结果：
- 串口是否释放：
- 是否出现同步噪声忽略日志：
- 失败时下一步排查：

## 必测矩阵

- macOS + CH340C 经典电路。
- macOS + CH340X 直连电路。
- Windows + CH340。
- Linux + `/dev/ttyUSB*` 或 `/dev/ttyACM*`。

## 记录示例

```text
[SerialFlash] Firmware: build/Debug/CAN2RS485.hex, HEX, 65536 bytes
[SerialFlash] Port: /dev/tty.usbserial-10 @ 115200 8E1
[SerialFlash] Reset: ch340x
[SerialFlash] Entering bootloader via DTR/RTS
[SerialFlash] Bootloader 0x31, PID 0x0413
[SerialFlash] Erase complete (extended)
[SerialFlash] Verify complete
[SerialFlash] Reset and run
[SerialFlash] Done
```
