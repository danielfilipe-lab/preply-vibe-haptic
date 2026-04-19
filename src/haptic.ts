import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './config'
import { DEFAULT_INTENSITY, resolvePattern } from './patterns'
import type { HapticConfig, HapticEvent, ResolvedPattern } from './types'

const PAUSE_DELAY_MS = 100

export interface BeatToken {
  type: 'tap' | 'pause'
  actuation?: number
  intensity?: number
  pauseCount?: number
}
export function parseBeat(beat: string, defaultIntensity: number): BeatToken[] {
  const tokens: BeatToken[] = []
  let i = 0

  while (i < beat.length) {
    const char = beat[i]

    if (char === ' ') {
      let pauseCount = 0
      while (i < beat.length && beat[i] === ' ') {
        pauseCount++
        i++
      }
      tokens.push({ type: 'pause', pauseCount })
    } else if (char >= '3' && char <= '6') {
      const actuation = Number(char)
      i++

      if (i < beat.length && beat[i] === '/') {
        i++
        let intensityStr = ''
        while (i < beat.length && beat[i] !== ' ') {
          intensityStr += beat[i]
          i++
        }
        const intensity = intensityStr ? Math.min(2, Math.max(0, parseFloat(intensityStr))) : defaultIntensity
        tokens.push({ type: 'tap', actuation, intensity })
      } else {
        tokens.push({ type: 'tap', actuation, intensity: defaultIntensity })
      }
    } else {
      i++
    }
  }

  return tokens
}

export type NativeModule = {
  actuate: (actuation: number, intensity: number) => void
  listDevices?: () => { id: bigint; isBuiltin: boolean }[]
  actuateWithDeviceId?: (deviceId: bigint, actuation: number, intensity: number) => void
}

export interface HapticEngineOptions {
  nativeModule?: NativeModule | null
}

export class HapticEngine {
  private config: HapticConfig
  private nativeModule: NativeModule | null = null
  private deviceId: bigint | null = null

  constructor(config: HapticConfig, options?: HapticEngineOptions) {
    this.config = config
    if (options?.nativeModule !== undefined) {
      this.nativeModule = options.nativeModule
    } else {
      this.loadNativeModule()
    }
    this.deviceId = this.resolveDeviceId()
  }

  private resolveDeviceId(): bigint | null {
    const preference = this.config.device ?? 'auto'
    this.debug('resolveDeviceId', { preference, hasListDevices: !!this.nativeModule?.listDevices })

    if (preference === 'auto' || !this.nativeModule?.listDevices) return null

    const devices = this.nativeModule.listDevices()
    this.debug('listDevices result', devices.map((d) => ({ id: d.id.toString(), isBuiltin: d.isBuiltin })))

    let result: bigint | null = null
    if (preference === 'external') result = devices.find((d) => !d.isBuiltin)?.id ?? null
    else if (preference === 'builtin') result = devices.find((d) => d.isBuiltin)?.id ?? null
    else try { result = BigInt(preference) } catch { result = null }

    this.debug('resolved deviceId', result?.toString() ?? 'null')
    return result
  }

  private debug(msg: string, data?: unknown) {
    if (process.env.VIBE_HAPTIC_DEBUG !== '1') return
    const { appendFileSync, existsSync, mkdirSync } = require('node:fs')
    const { homedir } = require('node:os')
    const logPath = `${homedir()}/.preply-vibe-haptic-debug.log`
    const line = `[haptic] ${msg}${data !== undefined ? ': ' + JSON.stringify(data, (_, v) => typeof v === 'bigint' ? v.toString() + 'n' : v) : ''}\n`
    appendFileSync(logPath, line)
  }

  private loadNativeModule() {
    if (process.platform !== 'darwin') {
      return
    }

    try {
      const currentDir = dirname(fileURLToPath(import.meta.url))
      const req = createRequire(import.meta.url)
      const candidates = [
        join(currentDir, '..', 'native', 'preply-vibe-haptic-native.node'),
        join(currentDir, '..', 'native', 'vibe-haptic-native.node'),
      ]
      for (const nativePath of candidates) {
        try {
          this.nativeModule = req(nativePath)
          this.debug('native module loaded', { path: nativePath, hasListDevices: !!this.nativeModule?.listDevices, hasActuateWithDeviceId: !!this.nativeModule?.actuateWithDeviceId })
          break
        } catch {}
      }
      if (!this.nativeModule) throw new Error('no native module found')
    } catch (e) {
      this.debug('native module load failed', String(e))
    }
  }

  playBeat(pattern: ResolvedPattern): Promise<void> {
    return new Promise((resolve) => {
      if (!this.nativeModule) {
        resolve()
        return
      }

      const { beat, intensity } = pattern
      const tokens = parseBeat(beat, intensity ?? DEFAULT_INTENSITY)
      const module = this.nativeModule
      let i = 0

      const playNext = () => {
        if (i >= tokens.length) {
          resolve()
          return
        }

        const token = tokens[i]
        i++

        if (token.type === 'pause') {
          setTimeout(playNext, (token.pauseCount ?? 1) * PAUSE_DELAY_MS)
        } else {
          if (this.deviceId !== null && module.actuateWithDeviceId) {
            this.debug('actuating with device', { deviceId: this.deviceId.toString(), actuation: token.actuation, intensity: token.intensity })
            module.actuateWithDeviceId(this.deviceId, token.actuation!, token.intensity!)
          } else {
            this.debug('actuating via auto-select', { actuation: token.actuation, intensity: token.intensity })
            module.actuate(token.actuation!, token.intensity!)
          }
          playNext()
        }
      }

      playNext()
    })
  }

  trigger(patternName: string): Promise<void> {
    const pattern = resolvePattern(patternName, this.config.patterns)

    if (pattern) {
      return this.playBeat(pattern)
    }
    return Promise.resolve()
  }

  triggerForEvent(event: HapticEvent): Promise<void> {
    const patternName = this.config.events?.[event]
    if (patternName) {
      return this.trigger(patternName)
    }
    return Promise.resolve()
  }
}

export function createHapticEngine(agent?: 'claude' | 'opencode' | 'codex'): HapticEngine {
  return new HapticEngine(loadConfig(agent))
}
