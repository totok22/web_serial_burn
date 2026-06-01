# Web MCU Burner

基于 Web Serial 和 STM32 USART Bootloader 的浏览器烧写工具，覆盖 STM32 串口 ISP 的自动进 Bootloader、擦除、烧写、校验和复位运行。

## 当前能力

- 浏览器端烧写 STM32 UART ISP。
- 支持 `.bin` 和 Intel HEX `.hex` 固件。
- 支持 CH340C 经典 DTR/RTS 自动进 Bootloader 电路。
- 提供 `ch340x` 直连电路自动时序，待 CH340X 硬件验证。
- 支持擦除、写入、读回校验、读保护解除。
- 提供 Node.js CLI，便于本机调试和硬件验证。
- macOS 提供 `start.command`，双击后启动本地服务并打开网站。
- CH340 电路细节见 `docs/CH340_HARDWARE.md`。

## 浏览器使用

1. 使用 Chrome 或 Edge。
2. 通过 HTTPS 或 localhost 打开页面。
3. 选择串口和 `.bin`/`.hex` 固件。
4. 按硬件选择预设：`CH340C 经典三极管电路` 或 `CH340X 直连电路`。
5. 点击“开始编程”。

本地启动：

```bash
python3 -m http.server 8080
```

打开：

```text
http://127.0.0.1:8080/index.html
```

macOS 可直接双击：

```text
start.command
```

## CLI 使用

安装依赖：

```bash
npm install
```

macOS CH340 通常同时有 `/dev/cu.*` 和 `/dev/tty.*`。自动 DTR/RTS 进 Bootloader 时优先使用 `/dev/tty.usbserial-*`。

已在 CH340C 经典电路上验证通过的命令：

```bash
node src/cli.js \
  --port /dev/tty.usbserial-10 \
  --file /Users/poli/STM32CubeIDE/workspace_2.1.1/PDM/Debug/PDM.hex \
  --reset dtr-low-rts-high \
  --timeout 3000 \
  --unlock
```

查看参数：

```bash
node src/cli.js --help
```

## CH340C 时序

项目内部使用统一电平语义：

- `true` 表示低电平。
- `false` 表示高电平。

经典 CH340C 自动 ISP 已验证入口序列：

1. RTS 低电平，选择 Bootloader。
2. DTR 低电平，触发复位。
3. DTR 高电平，释放复位。
4. 等待约 800ms 后发送 STM32 Sync `0x7F`。

该序列等价于 `stm32flash` 可工作的入口序列：

```bash
stm32flash -b 115200 -i -rts,-dtr,dtr /dev/tty.usbserial-10
```

CH340C、CH340X 电路差异和时序推导见 `docs/CH340_HARDWARE.md`。

CH340X 直连电路预设：

```bash
node src/cli.js --port <port> --file firmware.hex --reset ch340x
```

## 开发命令

```bash
npm test
node src/cli.js --help
```

## 已知限制

- Web Serial 必须由用户点击触发串口授权。
- CLI 依赖 `serialport`，浏览器端不需要该依赖。
- 当前自动流程只实现 STM32 USART Bootloader。
- CH340 自动复位电路差异较大，新增板型前应先用 CLI 验证 DTR/RTS 序列。
