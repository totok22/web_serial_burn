# STM32 Serial Flasher

[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code%20Marketplace-STM32%20Serial%20Flasher-blue?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=totok22.serialflash-stm32)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Flash STM32 firmware over USART Bootloader directly inside VS Code — no ST-Link, no external command-line tools. Enter bootloader, erase, write, verify, and reset-to-run, all from the editor.

Designed for dev boards using CH340 (or similar) USB-UART bridges with STM32 auto-download circuits.

> **中文用户**: 请参阅 [README.zh-CN.md](README.zh-CN.md)

---

## Which Version Do You Need?

This project has **two branches** for different workflows:

| Branch | Description | Best For |
| ------ | ----------- | -------- |
| [`vscode-extension`](https://github.com/totok22/SerialFlash/tree/vscode-extension) (you are here) | **VS Code extension** — install from marketplace, flash from the editor | VS Code users who want an integrated, one-click workflow |
| [`main`](https://github.com/totok22/SerialFlash/tree/main) | **Web Serial + CLI** — open a browser tab or use the terminal | Quick flashing without VS Code; CI/automation; any platform with a browser |

Both branches share the same STM32 UART ISP core, DTR/RTS reset presets, and firmware parsing logic. Pick the one that fits your setup.

---

## Screenshot

![STM32 Serial Flasher panel in VS Code](docs/assets/vscode-panel.png)

---

## Features

- **Auto-discover firmware** — scans the workspace for `.hex` / `.bin` files, ordered by modification time, path, and format. Single candidates are picked automatically.
- **One-command flash** — bootloader → erase → write → verify → run, with a single keystroke (`Cmd/Ctrl+Alt+F`).
- **Remembers your setup** — port, firmware, reset mode, and baud rate are persisted after the first successful flash.
- **Multiple entry points** — Activity Bar sidebar, Webview panel, Command Palette, file context menu, status bar, and VS Code Tasks.
- **Built-in CH340 presets** — cover common CH340C / CH340X auto-download circuits, with full custom DTR/RTS mapping.
- **Diagnostics & troubleshooting** — on failure, the Output channel gives targeted advice for timeouts, NACK, port conflicts, permissions, and verification mismatches.
- **Project profiles** — save named configurations for different targets and switch between them instantly.
- **Flash history** — tracks recent operations with port, address, byte count, and result.

---

## Requirements

- **VS Code 1.90+** (Desktop).
- An STM32 board with USART Bootloader connected via a USB-UART adapter (CH340, CP2102, etc.) recognized by your OS.
- No extra tools or drivers beyond what your USB-UART adapter requires. The extension bundles `serialport`.

> For Remote / Web limitations, see [Environment & Boundaries](#environment--boundaries).

---

## Quick Start

1. Open your firmware project folder in VS Code (a workspace containing `.hex` or `.bin` build artifacts).
2. Click the **SerialFlash** icon in the Activity Bar to open the sidebar.
3. In the **Current** section, confirm three items:
   - **Firmware** — leave blank for auto-discovery, or click to pick manually.
   - **Port** — select your board's serial port (macOS: `/dev/tty.usbserial-*`, Windows: `COM3`).
   - **Reset Mode** — choose a preset that matches your download circuit (the CH340C classic circuit default is `dtr-low-rts-high`).
4. Run **Flash Latest Firmware** (sidebar button, Command Palette, or `Cmd/Ctrl+Alt+F`).
5. Progress and logs appear in the flasher panel and Output channel. If it fails, check the Troubleshooting suggestions.

After the first success, port / firmware / reset mode / baud rate are remembered — subsequent flashes are one click.

---

## Interface & Entry Points

SerialFlash provides several complementary entry points. Use whichever fits your workflow.

### Activity Bar Sidebar

Click the SerialFlash icon to open the **Flasher** view, organized in three groups:

- **Current** — selected firmware, port, and reset mode (with baud rate / parity summary). Click any item to change it.
- **Actions** — quick shortcuts: Flash Latest Firmware, Open Flasher Panel, Select Project Profile, Show Output, Run Diagnostics.
- **History** — last 8 flash records with success/failure icons. Hover for timestamp, port, address, and byte count.

### Webview Panel

Open via **Open Flasher Panel** or the sidebar. The most complete graphical interface:

- **Status bar** at the top shows the current phase and progress percentage.
- **Target** section — confirm firmware, port, and reset mode. Includes a diagnostics shortcut.
- **Execution** section — main flash button, progress bar, cancel, plus quick actions (bootloader entry, reset & run, output). Toggle pills for erase, verify, run, close port, and unlock.
- **Collapsible sections** for advanced settings:
  - **Flash Parameters** — baud rate, address, packet size, timeout, parity, write options.
  - **Hardware Reset** — custom DTR/RTS signal mapping.
  - **Project & Automation** — profiles, project config, VS Code Tasks.
  - **Maintenance & Danger Zone** — verify, erase chip, unlock read protection, close port, clear memory.
- **Bottom area** — recent logs and history. Diagnostics and troubleshooting appear only when relevant.
- During a flash, configuration and dangerous actions are locked; only cancel, output, and diagnostics remain available.

### Command Palette

All commands are prefixed `SerialFlash:` (`Cmd/Ctrl+Shift+P`):

| Command | Description |
| ------- | ----------- |
| `Flash Latest Firmware` | Flash the current firmware (or auto-discover). Shortcut `Cmd/Ctrl+Alt+F` |
| `Flash Current File` | Set the open/right-clicked `.hex`/`.bin` as firmware and flash it |
| `Select Firmware` | Pick firmware from workspace candidates |
| `Set as SerialFlash Firmware` | Set a file as current firmware without flashing |
| `Show Firmware Info` | Show format, size, base address |
| `Select Serial Port` | Pick a serial port (list includes manufacturer, SN, VID/PID) |
| `Select Reset Mode` | Choose a DTR/RTS preset |
| `Open Flasher Panel` | Open the graphical webview panel |
| `Reset To Bootloader` | Drive the reset sequence to enter bootloader |
| `Reset And Run` | Reset and run user firmware |
| `Cancel Flash` | Cancel an in-progress flash |
| `Show Output` | Open the Output channel with full logs |
| `Run Diagnostics` | Show Extension Host, serialport status, and visible ports |
| `Erase Chip` | Mass erase (confirmation required) |
| `Verify Firmware` | Read back and verify current firmware |
| `Unlock Read Protection` | Remove read protection (erases entire chip, confirmation required) |
| `Close Port` | Release a still-open serial port |
| `Clear Remembered Device` | Forget port / firmware / reset / baud rate |
| `Create Project Config` | Write current config to `.vscode/settings.json` |
| `Create Tasks` | Generate `.vscode/tasks.json` |
| `Create Project Profile` | Save current config as a named profile |
| `Select Project Profile` | Switch between saved profiles |
| `Clear Flash History` | Clear flash history records |

### File Context Menu

Right-click a `.hex` or `.bin` file in Explorer or editor tab to: **Flash Current File**, **Verify Firmware**, **Set as SerialFlash Firmware**, **Show Firmware Info**.

### Status Bar

The status bar shows the current port. During a flash it shows phase and progress; click to open the panel or output.

---

## Reset Modes & Hardware

Entering the bootloader requires the correct DTR/RTS sequence. `serialFlash.resetMode` options:

- `dtr-low-rts-high` — CH340C classic auto-download circuit (default).
- `ch340x` — CH340X direct-connect circuit.
- `dtr-high-rts-low` — generic preset (DTR high = reset, RTS low = BOOT0).
- `none` — no control-line manipulation; enter bootloader manually.
- `custom` — fully custom mapping via `serialFlash.customReset.*`.

Hardware notes:

- The project convention: `true` = low level, `false` = high level.
- Do not mix CH340C and CH340X presets — the timing sequences differ and the wrong one won't enter the bootloader.
- On macOS, `/dev/tty.usbserial-*` is preferred over `/dev/cu.usbserial-*`.
- STM32 USART Bootloader defaults to `115200 8E1`.
- If unsure which preset to use, try the default `dtr-low-rts-high` first. If it keeps timing out, use `Reset To Bootloader` with the manual button to verify wiring, then try the other presets one by one.

See [docs/CH340_HARDWARE.md](docs/CH340_HARDWARE.md) for circuit diagrams, timing records, and troubleshooting notes. See [docs/STM32_PROTOCOL.md](docs/STM32_PROTOCOL.md) for protocol packet format.

---

## Project Config, Profiles & Tasks

- **Create Project Config** writes current settings to `.vscode/settings.json`, preserving existing VS Code settings.
- **Create Project Profile** saves current config into `serialFlash.projects` — useful when a workspace targets multiple boards. **Select Project Profile** switches between them.
- **Create Tasks** writes `.vscode/tasks.json` with `flash`, `bootloader`, and `run` tasks, preserving existing tasks. You can also declare tasks manually:

```json
{
  "label": "Flash Latest Firmware",
  "type": "serialFlash",
  "action": "flashLatest"
}
```

Valid `action` values: `flashLatest`, `bootloader`, `run`.

> The write-file commands above require an open workspace folder. If no workspace is open when only modifying settings, they fall back to user-level settings.

---

## Configuration Reference

Four write-phase toggles (adjustable in both the panel and settings):

| Option | Default | Effect |
| ------ | ------- | ------ |
| `eraseBeforeWrite` | on | Mass-erase before writing to avoid stale code |
| `verifyAfterWrite` | on | Read back and verify after writing — slower but confirms correctness |
| `runAfterWrite` | on | Reset and run user firmware after a successful flash |
| `closePortAfterWrite` | on | Close the port after completion; turn off to keep it open for debugging |

Full configuration example:

```json
{
  "serialFlash.firmware": "build/Debug/app.hex",
  "serialFlash.port": "/dev/tty.usbserial-10",
  "serialFlash.baudRate": 115200,
  "serialFlash.parity": "even",
  "serialFlash.resetMode": "dtr-low-rts-high",
  "serialFlash.customReset.boot0High": "dtr-false",
  "serialFlash.customReset.boot0Low": "",
  "serialFlash.customReset.resetAssert": "rts-true",
  "serialFlash.flashAddress": "0x08000000",
  "serialFlash.packetSize": 256,
  "serialFlash.timeout": 2000,
  "serialFlash.eraseBeforeWrite": true,
  "serialFlash.verifyAfterWrite": true,
  "serialFlash.runAfterWrite": true,
  "serialFlash.closePortAfterWrite": true,
  "serialFlash.unlockReadProtection": false,
  "serialFlash.autoDiscoverFirmware": true,
  "serialFlash.firmwareGlobs": ["**/*.hex", "**/*.bin"],
  "serialFlash.excludeGlobs": ["**/{node_modules,.git,dist}/**"],
  "serialFlash.projects": [
    {
      "name": "can2rs485",
      "firmware": "CAN2RS485/build/Debug/CAN2RS485.hex",
      "port": "/dev/tty.usbserial-10",
      "resetMode": "ch340x"
    }
  ]
}
```

Key points:

- When `serialFlash.flashAddress` is not set, HEX firmware uses the file's base address; BIN firmware defaults to `0x08000000`.
- `serialFlash.firmwareGlobs` / `serialFlash.excludeGlobs` narrow firmware discovery to avoid interference from multiple build artifacts.
- Enable `serialFlash.unlockReadProtection` only when you know the chip has read protection — it triggers a mass erase.

---

## Environment & Boundaries

- Full support for **VS Code Desktop** on macOS, Windows, and Linux.
- **Remote SSH / WSL / Dev Containers** can only access ports on the machine where the Extension Host actually runs. On activation, a notification shows the current Extension Host to avoid confusion.
- **vscode.dev / github.dev** are not supported — Web extensions cannot use Node `serialport`.
- When synchronizing with the bootloader, noise bytes from user-program output are ignored before ACK is received.

---

## Troubleshooting

When a flash fails, the panel's Troubleshooting section and Output channel give specific advice. Common situations:

| Symptom | Cause & Fix |
| ------- | ----------- |
| Port busy / access denied | Another serial monitor, terminal, flasher, or a previous connection is holding the port. Close it or use `Close Port`. |
| Permission denied (EACCES / EPERM) | Check port permissions. On Linux, add your user to the `dialout` (or `uucp`) group and re-login. |
| Timeout, no Bootloader ACK | Verify BOOT0/RESET wiring, reset mode, port selection, and `115200 8E1`. Try `Reset To Bootloader` or manual bootloader entry first, then swap presets. |
| Non-bootloader data received | The target may still be running user code and outputting serial data. Confirm bootloader entry first. |
| NACK returned | Check read protection, flash address, erase state, and whether the command is supported by your bootloader version. |
| Verification failed | Confirm the firmware matches the target board, `flashAddress` / HEX base address is correct, re-erase and re-flash. |
| Firmware parse failure | Rebuild or re-export `.hex` / `.bin`. Confirm the file is not a log, ELF, or truncated build artifact. |
| serialport native dependency unavailable | Reinstall dependencies or install from the packaged VSIX, then run `Run Diagnostics`. |

If still stuck, run `Run Diagnostics` to capture port, reset mode, bootloader version, and PID for further investigation.

---

## Development

```bash
npm install
npm test
npm run package
```

Open this repo in VS Code and use the Extension Development Host (F5) to debug. Core STM32 UART ISP logic lives in `src/core` and `src/stm32.js`; VS Code integration is in `src/vscode`. See [AGENTS.md](AGENTS.md) for architecture and conventions.

### Packaging

```bash
npm run package
```

The generated VSIX includes the `serialport` production dependency. See [docs/HARDWARE_VALIDATION.md](docs/HARDWARE_VALIDATION.md) for the hardware validation record template.

### Publishing

Before publishing, make sure `CHANGELOG.md` is up to date and both `npm test` and `npm run package` pass. Then, logged in as the publisher:

```bash
npm run publish
```

---

## License

MIT — see [LICENSE](LICENSE) for details.
