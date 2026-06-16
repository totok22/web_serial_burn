function messageOf(error) {
  return String(error?.message || error || "");
}

export function troubleshootingHints(error, context = {}) {
  const message = messageOf(error);
  const lower = message.toLowerCase();
  const hints = [];

  if (/ebusy|busy|resource busy|access denied|cannot lock/.test(lower)) {
    hints.push("关闭占用串口的串口监视器、终端、烧录工具或上一轮未释放的连接。");
  }

  if (/eacces|eperm|permission|not permitted/.test(lower)) {
    hints.push("检查串口权限；Linux 通常需要把当前用户加入 dialout/uucp 组后重新登录。");
  }

  if (/timeout|读取超时|bootloader ack|timed out/.test(lower)) {
    hints.push("没有收到 Bootloader ACK：确认 BOOT0/RESET 接线、复位模式、端口选择和 115200 8E1。");
    if (context.resetMode && context.resetMode !== "none") {
      hints.push(`当前 reset mode 是 ${context.resetMode}；如果持续超时，尝试 Select Reset Mode 或手动进入 Bootloader。`);
    }
  }

  if (/unexpected response|non-bootloader|ignored/.test(lower)) {
    hints.push("目标可能仍在运行用户程序并输出串口数据；先确认已进入 ROM Bootloader。");
  }

  if (/nack/.test(lower)) {
    hints.push("Bootloader 返回 NACK：检查芯片读保护、flash address、擦除状态和当前命令是否被该 Bootloader 支持。");
    hints.push("只有确认允许全片擦除时，才使用 Unlock Read Protection。");
  }

  if (/verify failed/.test(lower)) {
    hints.push("校验失败：检查固件是否对应当前板卡、flashAddress/HEX base address 是否正确，并重新擦除后再烧录。");
  }

  if (/hex|checksum|malformed|invalid firmware/.test(lower)) {
    hints.push("固件解析失败：重新构建或导出 .hex/.bin，确认文件不是日志、ELF 或被截断的产物。");
  }

  if (/serialport|native|module|dependency/.test(lower)) {
    hints.push("serialport 原生依赖不可用：重新安装依赖或用已打包 VSIX 安装，并运行 Run Diagnostics。");
  }

  if (hints.length === 0) {
    hints.push("打开 SerialFlash Output 查看完整日志；必要时运行 Run Diagnostics 并记录端口、reset mode、Bootloader 版本和 PID。");
  }

  return [...new Set(hints)];
}

export function appendTroubleshooting(output, error, context = {}) {
  const hints = troubleshootingHints(error, context);
  output.append("Troubleshooting:");
  hints.forEach((hint) => output.append(`- ${hint}`));
  return hints;
}
