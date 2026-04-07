#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { DEFAULT_PATTERNS } from '../patterns'

interface Device { id: bigint; isBuiltin: boolean }
interface NativeModule {
  listDevices: () => Device[]
  actuateWithDeviceId: (deviceId: bigint, actuationId: number, intensity: number) => void
}

const currentDir = dirname(fileURLToPath(import.meta.url))
const req = createRequire(import.meta.url)
const candidates = [
  join(currentDir, '..', '..', 'native', 'preply-vibe-haptic-native.node'),
  join(currentDir, '..', '..', 'native', 'vibe-haptic-native.node'),
]
let native: NativeModule | undefined
for (const p of candidates) { try { native = req(p); break } catch {} }
if (!native) { console.error('Could not load native module. Run `bun run build` first.'); process.exit(1) }
if (!native.listDevices || !native.actuateWithDeviceId) { console.error('Native module outdated. Run `bun run build`.'); process.exit(1) }
const nativeModule = native as NativeModule

const devices = nativeModule.listDevices()
if (devices.length === 0) { console.error('No haptic-capable trackpads detected.'); process.exit(1) }

const configPath = join(homedir(), '.claude', 'vibe-haptic.json')
function loadConfig(): Record<string, unknown> {
  if (existsSync(configPath)) { try { return JSON.parse(readFileSync(configPath, 'utf-8')) } catch {} }
  return {}
}

const STOP_PATTERNS  = ['vibe', 'knock', 'thud', 'confirm', 'heartbeat', 'pulse', 'dopamine']
const ALERT_PATTERNS = ['alert', 'chirp', 'tick', 'noise', 'vibe', 'knock']

const RESET = '\x1b[0m'; const DIM = '\x1b[2m'; const GREEN = '\x1b[32m'
const BOLD = '\x1b[1m'; const CYAN = '\x1b[36m'

const saved = loadConfig()
let trackpadIdx = devices.findIndex(d => !d.isBuiltin)
if (trackpadIdx < 0) trackpadIdx = 0
let stopIdx = STOP_PATTERNS.indexOf((saved.events as any)?.stop ?? 'vibe')
if (stopIdx < 0) stopIdx = 0
let promptIdx = ALERT_PATTERNS.indexOf((saved.events as any)?.prompt ?? 'alert')
if (promptIdx < 0) promptIdx = 0

type Section = 'trackpad' | 'stop' | 'prompt'
let section: Section = 'trackpad'
let status = ''

function deviceTag(d: Device) { return d.isBuiltin ? 'built-in' : 'external' }
function deviceLabel(d: Device) { return d.isBuiltin ? 'Built-in Trackpad' : 'Magic Trackpad' }

function playPattern(name: string, deviceId: bigint) {
  const p = DEFAULT_PATTERNS[name]
  if (!p) return
  const baseIntensity = p.intensity ?? 1.0
  const beats = p.beat.split(' ')
  let delay = 0
  for (const token of beats) {
    if (token === '') { delay += 100; continue }
    const [actStr, intStr] = token.split('/')
    for (const ch of actStr) {
      const actuation = parseInt(ch)
      if (actuation >= 3 && actuation <= 6) {
        const intensity = (intStr ? Math.min(2, parseFloat(intStr)) : 1.0) * baseIntensity
        setTimeout(() => { try { nativeModule.actuateWithDeviceId(deviceId, actuation, intensity) } catch {} }, delay)
        delay += 30
      }
    }
  }
}

function sectionHeader(label: string, active: boolean) {
  const color = active ? `${GREEN}${BOLD}` : DIM
  return `${color}${label}${RESET}`
}

function render() {
  process.stdout.write('\x1b[2J\x1b[H')
  process.stdout.write(`${BOLD}preply-vibe-haptic setup${RESET}\n\n`)

  // Trackpad
  process.stdout.write(`${sectionHeader('Trackpad', section === 'trackpad')}\n`)
  for (let i = 0; i < devices.length; i++) {
    const d = devices[i]
    const cursor = i === trackpadIdx ? `${GREEN}❯${RESET}` : ' '
    const active = section === 'trackpad' ? cursor : (i === trackpadIdx ? `${DIM}•${RESET}` : ' ')
    process.stdout.write(`  ${active} ${deviceLabel(d)} ${DIM}(${deviceTag(d)})${RESET}\n`)
  }

  process.stdout.write('\n')

  // Stop pattern
  process.stdout.write(`${sectionHeader('Task complete pattern', section === 'stop')}\n`)
  for (let i = 0; i < STOP_PATTERNS.length; i++) {
    const name = STOP_PATTERNS[i]
    const cursor = i === stopIdx ? `${GREEN}❯${RESET}` : ' '
    const active = section === 'stop' ? cursor : (i === stopIdx ? `${DIM}•${RESET}` : ' ')
    const label = DEFAULT_PATTERNS[name]?.label ?? name
    process.stdout.write(`  ${active} ${label}\n`)
  }

  process.stdout.write('\n')

  // Prompt pattern
  process.stdout.write(`${sectionHeader('Needs attention pattern', section === 'prompt')}\n`)
  for (let i = 0; i < ALERT_PATTERNS.length; i++) {
    const name = ALERT_PATTERNS[i]
    const cursor = i === promptIdx ? `${GREEN}❯${RESET}` : ' '
    const active = section === 'prompt' ? cursor : (i === promptIdx ? `${DIM}•${RESET}` : ' ')
    const label = DEFAULT_PATTERNS[name]?.label ?? name
    process.stdout.write(`  ${active} ${label}\n`)
  }

  process.stdout.write(`\n${DIM}[↑↓] Navigate  [Tab] Switch section  [T] Test  [S] Save & quit  [Q] Quit${RESET}\n`)
  if (status) process.stdout.write(`\n${status}\n`)
}

function currentDeviceId() { return devices[trackpadIdx].id }

function save() {
  const config = loadConfig()
  config.device = deviceTag(devices[trackpadIdx])
  config.events = { stop: STOP_PATTERNS[stopIdx], prompt: ALERT_PATTERNS[promptIdx] }
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
  status = `${GREEN}✓${RESET} Saved`
  render()
  setTimeout(() => { process.stdout.write('\x1b[2J\x1b[H'); process.exit(0) }, 1000)
}

render()

process.stdin.setRawMode(true)
process.stdin.resume()
process.stdin.setEncoding('utf8')

const SECTIONS: Section[] = ['trackpad', 'stop', 'prompt']

process.stdin.on('data', (key: string) => {
  if (key === '\x03' || key === 'q' || key === 'Q') {
    process.stdout.write('\x1b[2J\x1b[H'); process.exit(0)
  }
  if (key === 's' || key === 'S') { save(); return }

  // Tab cycles sections
  if (key === '\t') {
    section = SECTIONS[(SECTIONS.indexOf(section) + 1) % SECTIONS.length]
    status = ''; render(); return
  }

  const up   = key === '\x1b[A'
  const down = key === '\x1b[B'

  if (section === 'trackpad') {
    if (up)   { trackpadIdx = (trackpadIdx - 1 + devices.length) % devices.length; status = ''; render() }
    if (down) { trackpadIdx = (trackpadIdx + 1) % devices.length; status = ''; render() }
  } else if (section === 'stop') {
    if (up)   { stopIdx = (stopIdx - 1 + STOP_PATTERNS.length) % STOP_PATTERNS.length; playPattern(STOP_PATTERNS[stopIdx], currentDeviceId()); status = ''; render() }
    if (down) { stopIdx = (stopIdx + 1) % STOP_PATTERNS.length; playPattern(STOP_PATTERNS[stopIdx], currentDeviceId()); status = ''; render() }
  } else {
    if (up)   { promptIdx = (promptIdx - 1 + ALERT_PATTERNS.length) % ALERT_PATTERNS.length; playPattern(ALERT_PATTERNS[promptIdx], currentDeviceId()); status = ''; render() }
    if (down) { promptIdx = (promptIdx + 1) % ALERT_PATTERNS.length; playPattern(ALERT_PATTERNS[promptIdx], currentDeviceId()); status = ''; render() }
  }

  if (key === 't' || key === 'T') {
    if (section === 'trackpad') {
      playPattern('vibe', currentDeviceId())
      status = `Testing ${deviceLabel(devices[trackpadIdx])}...`
    } else if (section === 'stop') {
      playPattern(STOP_PATTERNS[stopIdx], currentDeviceId())
      status = `Testing "${STOP_PATTERNS[stopIdx]}"...`
    } else {
      playPattern(ALERT_PATTERNS[promptIdx], currentDeviceId())
      status = `Testing "${ALERT_PATTERNS[promptIdx]}"...`
    }
    render()
  }
})
