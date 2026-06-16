# Contributing

## Development

```bash
npm install
npm test
```

在 VS Code 中使用 Extension Development Host 调试插件命令、右键菜单、Output Channel、状态栏和 Webview。

## Hardware Changes

- Keep protocol logic separate from transport adapters.
- Record new DTR/RTS board behavior in `docs/CH340_HARDWARE.md`.
- Include board type, port, firmware path, VS Code command, Bootloader version, PID, and result.
- Do not shorten reset or Bootloader wait times without hardware verification.

## Pull Requests

- Keep changes focused.
- Add or update tests for protocol, parser, firmware discovery, flash session, or reset-sequence changes.
- Update README or docs when user-visible behavior changes.
