# Contributing

## Prerequisites

- **Bun** v1.0+
- **Rust** toolchain (only needed to rebuild the native module)
- **Xcode Command Line Tools**

```bash
# Rust (only if modifying native/src/lib.rs)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Xcode CLI tools
xcode-select --install
```

## Build Scripts

| Command | What it does |
|---------|-------------|
| `bun run build` | Full build — native Rust module + JS/TS |
| `bun run build:js` | JS/TS only — no Rust required |
| `bun run build:native` | Native module only |
| `bun run setup` | Interactive trackpad + pattern picker |
| `bun run play <pattern>` | Test a haptic pattern in the terminal |
| `bun test` | Run tests |
| `bun run typecheck` | TypeScript type check |
| `bun run lint` | Lint with Biome |
| `bun run lint:fix` | Auto-fix lint issues |

## Local Development

```bash
bun install
bun run build
claude plugin add file://$PWD  # register with Claude Code
bun run setup                   # pick trackpad & patterns
```

Then run `claude` normally — the plugin loads from your local directory.

## Testing the Hook Directly

Simulate a Claude Code Stop event without running a full session:

```bash
echo '{"session_id":"test","transcript_path":"/tmp","cwd":"/tmp","hook_event_name":"Stop"}' \
  | node hooks/haptic-hook.js
```

Enable debug logging:

```bash
echo '{"session_id":"test","transcript_path":"/tmp","cwd":"/tmp","hook_event_name":"Stop"}' \
  | VIBE_HAPTIC_DEBUG=1 node hooks/haptic-hook.js

cat ~/.preply-vibe-haptic-debug.log
```

## Native Module

The native module (`native/src/lib.rs`) wraps macOS's private `MultitouchSupport.framework` via [napi-rs](https://napi.rs).

Key exports:
- `listDevices()` — enumerate all haptic-capable trackpads with their IDs and built-in status
- `actuate(actuationId, intensity)` — fire haptic on the auto-selected device
- `actuateWithDeviceId(deviceId, actuationId, intensity)` — fire on a specific device

The built binary (`native/preply-vibe-haptic-native.node`) is committed to the repo so most contributors don't need Rust installed.

## Architecture

```
hooks/haptic-hook.js   ← bundled entry point invoked by Claude Code hooks
src/
  haptic.ts            ← HapticEngine: loads native module, resolves device, plays patterns
  patterns.ts          ← built-in pattern library with beat notation
  config.ts            ← loads ~/.claude/vibe-haptic.json
  types.ts             ← shared types
  claude/hook.ts       ← Claude Code hook handler (reads stdin, fires events)
  bin/setup.ts         ← interactive setup UI
native/src/lib.rs      ← Rust/NAPI-RS native module
```
