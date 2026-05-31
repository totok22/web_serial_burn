# Repository Guidelines

## Project Structure & Module Organization

This repository currently contains the product and protocol plan in `计划.md`. It describes a browser-based STM32 flashing tool using the Web Serial API, CH340 DTR/RTS control, and the STM32 AN3155 ISP protocol.

When implementation begins, keep application code in `src/`, browser assets in `public/` or `assets/`, and tests in `tests/` or colocated `*.test.js` files. Suggested module boundaries:

- `src/serial/`: Web Serial port setup, readers, writers, timeouts.
- `src/stm32/`: bootloader protocol commands, checksums, erase/write/read flows.
- `src/ui/`: browser UI components and progress/log presentation.

## Build, Test, and Development Commands

No build system is committed yet. Do not assume `npm` scripts exist until `package.json` is added. Once a frontend stack is introduced, document and maintain these commands:

- `npm install`: install project dependencies.
- `npm run dev`: start the local browser development server.
- `npm test`: run automated tests.
- `npm run build`: create production output, usually in `dist/`.

Keep generated folders such as `node_modules/`, `dist/`, and `build/` out of git; they are already ignored.

## Coding Style & Naming Conventions

Use modern JavaScript or TypeScript with 2-space indentation. Prefer small protocol functions with explicit byte-level names, for example `enterBootloader`, `waitAck`, `calcXor`, and `writeMemory`. Keep constants such as `ACK = 0x79`, `NACK = 0x1f`, and `FLASH_BASE = 0x08000000` centralized.

Comments should explain hardware timing, signal inversion, or protocol edge cases. Avoid comments that restate obvious code.

## Testing Guidelines

Prioritize unit tests for protocol packet creation, XOR checksums, ACK/NACK handling, timeout behavior, and 4-byte flash padding. Hardware-dependent Web Serial flows should be isolated behind small adapters so they can be mocked in tests.

Name tests after behavior, such as `writeMemory builds address checksum` or `readBytes rejects on timeout`.

## Commit & Pull Request Guidelines

Current history uses short, imperative commit subjects, for example `Add .gitignore`. Continue that style: `Add serial handshake`, `Fix ACK timeout handling`.

Pull requests should include a clear summary, test results, and screenshots or short recordings for UI changes. For protocol changes, mention the affected STM32 command bytes and any hardware setup used for verification.

## Security & Configuration Tips

Do not commit firmware binaries, logs containing device details, or `.env*` files. Web Serial requires HTTPS or localhost and must call `navigator.serial.requestPort()` from a direct user action.
