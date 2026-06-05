# Contributing

## Development

```bash
npm install
npm test
python3 -m http.server 8080
```

Open `http://127.0.0.1:8080/index.html` for Web Serial testing.

## Hardware Changes

- Keep protocol logic separate from transport adapters.
- Record new DTR/RTS board behavior in `docs/CH340_HARDWARE.md`.
- Include board type, port, firmware path, command, Bootloader version, PID, and result.
- Do not shorten reset or Bootloader wait times without hardware verification.

## Pull Requests

- Keep changes focused.
- Add or update tests for protocol, parser, or reset-sequence changes.
- Update README or docs when user-visible behavior changes.
