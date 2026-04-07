# Preply Vibe Haptic

Haptic feedback for your AI coding agents — feel the rhythm of your session through your trackpad.

Get a tactile nudge when Claude finishes a task or needs your attention, without notifications, sounds, or anything that breaks your flow.

## How It Works

macOS Force Touch trackpads use a Taptic Engine (linear actuator) to simulate physical clicks. Preply Vibe Haptic taps into macOS's private `MultitouchSupport.framework` to trigger haptic actuations directly — including on an **external Magic Trackpad**.

## What Triggers It

| Event | When |
|-------|------|
| `stop` | Claude finishes every response |
| `prompt` | Claude needs input — permission requests, tool approvals |

## Installation

### Prerequisites

- macOS with a Force Touch trackpad (built-in or Magic Trackpad)
- [Bun](https://bun.sh) installed
- Node.js (comes with macOS)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/danielfilipe-lab/preply-vibe-haptic.git
cd preply-vibe-haptic

# 2. Install dependencies and build
bun install && bun run build:js

# 3. Register with Claude Code (one-time)
bun run install-plugin

# 4. Pick your trackpad and patterns
bun run setup
```

Restart Claude Code after step 3. Haptic fires automatically on every response from then on.

> **Note:** `bun run build:js` is enough for most installs — the native binary is pre-built and committed to the repo. Only run `bun run build` (full build with Rust) if you're modifying the native module.

## Setup UI

Run `bun run setup` for an interactive picker:

```
preply-vibe-haptic setup

Trackpad
  ❯ Magic Trackpad   (external)
    Built-in Trackpad (built-in)

Task complete pattern
  ❯ Knock      — two firm knocks
    Heartbeat  — lub-dub pulse
    ...

Needs attention pattern
  ❯ Alert      — soft-hard-soft
    Chirp      — rising tap sequence
    ...

[↑↓] Navigate  [Tab] Switch section  [T] Test  [S] Save & quit  [Q] Quit
```

- **Tab** switches between sections (Trackpad / Task complete / Needs attention)
- **↑↓** navigates within a section — patterns fire as you scroll so you can feel them
- **T** repeats the current pattern on demand
- **S** saves and exits

Preferences are saved to `~/.claude/vibe-haptic.json`.

## Patterns

### Built-in Patterns

| Pattern | Description | Default for |
|---------|-------------|-------------|
| `vibe` | Soft-firm double tap | — |
| `knock` | Two firm knocks | — |
| `thud` | Single heavy hit | — |
| `confirm` | Soft then firm | — |
| `heartbeat` | Lub-dub pulse | — |
| `pulse` | Rising build-up | — |
| `dopamine` | Reward burst | — |
| `alert` | Soft-hard-soft | `prompt` |
| `chirp` | Rising tap sequence | — |
| `tick` | Single light tap | — |
| `noise` | Rapid texture burst | — |

### Custom Patterns

Add custom patterns to `~/.claude/vibe-haptic.json`:

```json
{
  "device": "external",
  "events": {
    "stop": "knock",
    "prompt": "chirp"
  },
  "patterns": {
    "my-pattern": { "beat": "6/1.0  4/0.5  6/1.0" }
  }
}
```

### Beat Notation

```
"6/0.8 3/1.0   6/1.0"
```

- **Digits 3–6** — actuation strength (`3` = lightest, `6` = strongest)
- **`/intensity`** — multiplier from 0.0 to 2.0
- **Spaces** — pauses (100ms per space)

## Configuration Reference

`~/.claude/vibe-haptic.json`:

| Field | Values | Description |
|-------|--------|-------------|
| `device` | `"external"`, `"builtin"`, `"auto"` | Which trackpad to use |
| `events.stop` | pattern name | Pattern for task complete |
| `events.prompt` | pattern name | Pattern for attention needed |
| `patterns` | `{ name: { beat, intensity? } }` | Custom patterns |

## Rebuilding the Native Module

Only needed if you change `native/src/lib.rs`:

```bash
# Requires Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

bun run build  # rebuilds native + JS
```

## Testing a Pattern Directly

```bash
# Named pattern
bun run play knock

# Custom beat
bun run play "6/1.0  6/1.0"

# Simulate a hook event
echo '{"session_id":"test","transcript_path":"/tmp","cwd":"/tmp","hook_event_name":"Stop"}' \
  | node hooks/haptic-hook.js
```
