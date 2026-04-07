#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

interface Device {
  id: bigint
  isBuiltin: boolean
}

interface NativeModule {
  listDevices: () => Device[]
  actuateWithDeviceId: (deviceId: bigint, actuationId: number, intensity: number) => void
}

const currentDir = dirname(fileURLToPath(import.meta.url))
const nativePath = join(currentDir, '..', '..', 'native', 'vibe-haptic-native.node')
const req = createRequire(import.meta.url)

let native: NativeModule
try {
  native = req(nativePath)
} catch {
  console.error('Could not load native module. Run `bun run build` first.')
  process.exit(1)
}

if (!native.listDevices || !native.actuateWithDeviceId) {
  console.error('Native module is outdated. Run `bun run build` to rebuild.')
  process.exit(1)
}

const devices = native.listDevices()
if (devices.length === 0) {
  console.error('No haptic-capable trackpads detected.')
  process.exit(1)
}

const configPath = join(homedir(), '.claude', 'vibe-haptic.json')

function loadConfig(): Record<string, unknown> {
  if (existsSync(configPath)) {
    try {
      return JSON.parse(readFileSync(configPath, 'utf-8'))
    } catch {}
  }
  return {}
}

function deviceLabel(d: Device) {
  return d.isBuiltin ? 'Built-in Trackpad' : 'Magic Trackpad'
}

function deviceTag(d: Device) {
  return d.isBuiltin ? 'built-in' : 'external'
}

let selectedIdx = 0
let status = ''

// Pre-select the device matching current config
const currentConfig = loadConfig()
const currentPref = (currentConfig.device as string) ?? 'auto'
if (currentPref === 'external') {
  const idx = devices.findIndex((d) => !d.isBuiltin)
  if (idx >= 0) selectedIdx = idx
} else if (currentPref === 'builtin') {
  const idx = devices.findIndex((d) => d.isBuiltin)
  if (idx >= 0) selectedIdx = idx
} else {
  try {
    const id = BigInt(currentPref)
    const idx = devices.findIndex((d) => d.id === id)
    if (idx >= 0) selectedIdx = idx
  } catch {}
}

const RESET = '\x1b[0m'
const DIM = '\x1b[2m'
const GREEN = '\x1b[32m'
const BOLD = '\x1b[1m'

function render() {
  process.stdout.write('\x1b[2J\x1b[H')
  process.stdout.write(`${BOLD}vibe-haptic › trackpad setup${RESET}\n\n`)
  process.stdout.write('Detected trackpads:\n')
  for (let i = 0; i < devices.length; i++) {
    const d = devices[i]
    const cursor = i === selectedIdx ? `${GREEN}❯${RESET}` : ' '
    const label = deviceLabel(d)
    const tag = `${DIM}(${deviceTag(d)}, id: ${d.id.toString()})${RESET}`
    process.stdout.write(`  ${cursor} ${label} ${tag}\n`)
  }
  process.stdout.write(`\n${DIM}[↑↓] Navigate  [T] Test  [S] Save & quit  [Q] Quit${RESET}\n`)
  if (status) process.stdout.write(`\n${status}\n`)
}

function testSelected() {
  const d = devices[selectedIdx]
  status = `Testing ${deviceLabel(d)}...`
  render()
  try {
    native.actuateWithDeviceId(d.id, 6, 1.0)
    setTimeout(() => {
      native.actuateWithDeviceId(d.id, 6, 1.0)
      status = `${GREEN}✓${RESET} Felt it? That was ${deviceLabel(d)}.`
      render()
    }, 200)
  } catch (e) {
    status = `✗ Failed: ${e}`
    render()
  }
}

function saveSelected() {
  const d = devices[selectedIdx]
  const config = loadConfig()
  config.device = deviceTag(d)
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
  status = `${GREEN}✓${RESET} Saved — device set to "${deviceTag(d)}"`
  render()
  setTimeout(() => {
    process.stdout.write('\x1b[2J\x1b[H')
    process.exit(0)
  }, 1200)
}

render()

process.stdin.setRawMode(true)
process.stdin.resume()
process.stdin.setEncoding('utf8')

process.stdin.on('data', (key: string) => {
  // Ctrl+C or Q → quit
  if (key === '\x03' || key === 'q' || key === 'Q') {
    process.stdout.write('\x1b[2J\x1b[H')
    process.exit(0)
  }

  // Up arrow
  if (key === '\x1b[A') {
    selectedIdx = (selectedIdx - 1 + devices.length) % devices.length
    status = ''
    render()
    return
  }

  // Down arrow
  if (key === '\x1b[B') {
    selectedIdx = (selectedIdx + 1) % devices.length
    status = ''
    render()
    return
  }

  if (key === 't' || key === 'T') {
    testSelected()
    return
  }

  if (key === 's' || key === 'S') {
    saveSelected()
    return
  }
})
