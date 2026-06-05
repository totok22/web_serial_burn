# Web MCU Burner

基于 Web Serial 和 STM32 USART Bootloader 的浏览器烧写工具，同时提供 Node.js CLI 便于硬件验证和自动化烧写。

## 功能

- STM32 UART ISP 自动进 Bootloader、擦除、写入、校验和运行。
- 支持 `.bin` 和 Intel HEX `.hex` 固件。
- 内置 CH340C 经典电路、CH340X 直连电路和常见 DTR/RTS 组合预设。
- 支持读保护解除、烧写后运行、完成后关闭串口。
- 提供 Web UI 和 CLI 两种入口。

## 浏览器使用

Web Serial 需要 Chrome/Edge，并通过 HTTPS 或 localhost 打开页面。

```bash
python3 -m http.server 8080
```

打开：

```text
http://127.0.0.1:8080/index.html
```

macOS 可双击：

```text
start.command
```

使用流程：

1. 选择串口。
2. 选择 `.bin` 或 `.hex` 固件。
3. 选择 DTR/RTS 复位模式，常用预设为 `CH340C 经典电路` 和 `CH340X 直连电路`。
4. 按需设置擦除、完整校验、运行和关闭串口。
5. 点击“开始编程”。

## CLI 使用

安装依赖：

```bash
npm install
```

查看参数：

```bash
node src/cli.js --help
```

示例：

```bash
node src/cli.js \
  --port /dev/tty.usbserial-10 \
  --file firmware.hex \
  --reset ch340x \
  --timeout 3000 \
  --unlock
```

macOS CH340 通常同时存在 `/dev/cu.*` 和 `/dev/tty.*`。自动 DTR/RTS 进 Bootloader 时优先使用 `/dev/tty.usbserial-*`。

## 硬件预设

项目内部统一约定：

- `true` 表示低电平。
- `false` 表示高电平。

Node `serialport` 的 modem 线布尔语义与项目约定相反，适配层会自动取反；Web Serial 路径单独处理浏览器侧行为。

硬件电路、时序记录和排查经验见 [docs/CH340_HARDWARE.md](docs/CH340_HARDWARE.md)。
协议包格式见 [docs/STM32_PROTOCOL.md](docs/STM32_PROTOCOL.md)。

## 开发

```bash
npm test
node src/cli.js --help
```

## 已知限制

- Web Serial 必须由用户点击触发串口授权。
- 当前自动流程只实现 STM32 USART Bootloader。
- 不同下载板的 DTR/RTS 极性差异较大，新增板型前应先用 CLI 或 Web 预设组合验证。
