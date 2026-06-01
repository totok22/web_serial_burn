# CH340 DTR/RTS 硬件说明

## 电平约定

项目内部统一约定：

- `true`：低电平。
- `false`：高电平。

Node `serialport` 的 modem 线布尔值语义相反，因此 `src/node-serial-transport.js` 内部会对 DTR/RTS 取反。

## 经典 CH340C 电路

常见 STM32 串口下载板会在 CH340C 外围加入三极管电路：

- DTR 参与 RESET 控制。
- RTS 参与 BOOT0/ISP 选择。
- DTR 和 RTS 同电平时，三极管通常截止，引脚由板载上下拉决定。
- DTR 和 RTS 一高一低时，电路会主动驱动 RESET 或 BOOT0。

当前板子已验证入口序列：

1. RTS 低电平。
2. DTR 低电平。
3. DTR 高电平。
4. 等待约 800ms。
5. 发送 STM32 同步字节 `0x7F`。

等价的 `stm32flash` 验证命令：

```bash
stm32flash -b 115200 -i -rts,-dtr,dtr /dev/tty.usbserial-10
```

已验证 CLI 命令：

```bash
node src/cli.js \
  --port /dev/tty.usbserial-10 \
  --file /Users/poli/STM32CubeIDE/workspace_2.1.1/PDM/Debug/PDM.hex \
  --reset dtr-low-rts-high \
  --timeout 3000 \
  --unlock
```

验证对象：

- CH340C 经典电路。
- STM32F10xxx Medium-density。
- Bootloader `0x22`。
- PID `0x0410`。

## CH340X 直连电路

部分 CH340X 板子会更直接地连接 modem 输出：

- 一根线控制 RESET。
- 一根线控制 BOOT0。
- 有效极性可能与经典 CH340C 三极管电路不同。

不要把 CH340C 序列直接套用到 CH340X。CH340X 应独立成预设，并通过硬件验证。

## CH340X 时序推导

某个 CH340X 直连电路上，曾观察到两组复位/BOOT 极性切换后可以完成下载。该现象的价值不在于人工步骤本身，而在于暴露了直连电路需要的连续物理时序：

- 先建立“RESET 被压住、BOOT0 被置入 Bootloader 条件”的状态。
- 再释放 RESET，让 MCU 在 BOOT0 有效窗口进入 ROM ISP。
- 下载阶段应维持可通讯状态，不再停留在 RESET 被压住的状态。

项目实现：

- `ch340x` 预设直接合成上述物理时序。
- 入口：建立 BOOT 条件并压住 RESET，然后释放 RESET 进入通讯态。
- 退出：保持 BOOT 运行态，脉冲 RESET，释放复位运行用户程序。
- 该预设已写入 CLI 和浏览器 UI，尚待 CH340X 硬件实测。

## 排查清单

- 使用 `115200 8E1`。
- macOS CLI 自动复位优先使用 `/dev/tty.usbserial-*`。
- 如果持续读到用户程序输出，说明没有进入 ROM Bootloader。
- 如果 Sync 成功但 GET 超时，先检查 STM32 响应解析，不要先改硬件时序。
- 新板型改预设前，先用 `stm32flash` 或只读命令验证。
