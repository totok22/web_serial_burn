# STM32 USART Bootloader Protocol

本项目实现 STM32 USART Bootloader 的常用子集，主要参考 AN3155 的包格式和命令流程。

## Serial

- Baud rate: `115200`
- Data bits: `8`
- Parity: `even`
- Stop bits: `1`
- Flow control: `none`

## Bytes

- Sync: `0x7F`
- ACK: `0x79`
- NACK: `0x1F`

## Packets

- 命令包：`CMD, CMD ^ 0xFF`
- 地址包：4 字节大端地址 + XOR
- 写入包：`length - 1` + 数据 + XOR
- 写入数据按 4 字节对齐，末尾用 `0xFF` 填充。

## Commands

- `0x00` GET
- `0x02` GET ID
- `0x11` READ MEMORY
- `0x21` GO
- `0x31` WRITE MEMORY
- `0x43` ERASE
- `0x44` EXTENDED ERASE
- `0x92` READOUT UNPROTECT

## Flow

1. 打开 `115200 8E1` 串口。
2. 通过 DTR/RTS 或手动按键进入 Bootloader。
3. 发送 `0x7F` 同步并读取 Bootloader 信息。
4. 按需解除读保护和擦除 Flash。
5. 分块写入固件。
6. 可选读回校验。
7. 通过 GO 或硬件复位运行用户程序。
