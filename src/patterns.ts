import type { PatternConfig, ResolvedPattern } from './types'

export const DEFAULT_INTENSITY = 1.0

export const DEFAULT_PATTERNS: Record<string, PatternConfig & { label: string }> = {
  // --- stop patterns ---
  vibe:      { label: 'Vibe       — soft-firm double',     beat: '6/0.8 3/1.0   6/1.0' },
  knock:     { label: 'Knock      — two firm knocks',      beat: '6/1.0  6/1.0' },
  thud:      { label: 'Thud       — single heavy hit',     beat: '6/1.5' },
  confirm:   { label: 'Confirm    — soft then firm',       beat: '4/0.6  6/1.0' },
  heartbeat: { label: 'Heartbeat  — lub-dub pulse',        beat: '6/0.4 6/1.0   6/0.4 6/1.0' },
  pulse:     { label: 'Pulse      — rising build-up',      beat: '3/0.5 4/0.7 5/0.9 6/1.1' },
  dopamine:  { label: 'Dopamine   — reward burst',         beat: '6666666 5/1.0 4/1.0 3/1.0', intensity: 0.1 },
  // --- prompt/alert patterns ---
  alert:     { label: 'Alert      — soft-hard-soft',       beat: '6/0.5 6/1.0 6/0.5' },
  chirp:     { label: 'Chirp      — rising tap sequence',  beat: '3/0.8 4/0.8 5/0.8 6/0.8' },
  tick:      { label: 'Tick       — single light tap',     beat: '3/0.6' },
  noise:     { label: 'Noise      — rapid texture burst',  beat: '6543654365436543' },
}

export function resolvePattern(
  nameOrBeat: string,
  patterns: Record<string, string | PatternConfig> | undefined,
): ResolvedPattern | null {
  const isInlineBeat = /^[3-6/.\s]+$/.test(nameOrBeat)
  if (isInlineBeat) {
    return { beat: nameOrBeat }
  }

  const userPattern = patterns?.[nameOrBeat]
  if (userPattern) {
    if (typeof userPattern === 'string') {
      return { beat: userPattern }
    }
    return {
      beat: userPattern.beat,
      intensity: userPattern.intensity,
    }
  }

  const defaultPattern = DEFAULT_PATTERNS[nameOrBeat]
  if (defaultPattern) {
    return {
      beat: defaultPattern.beat,
      intensity: defaultPattern.intensity,
    }
  }

  return null
}
