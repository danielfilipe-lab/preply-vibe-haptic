export type HapticEvent = 'stop' | 'prompt'

export interface PatternConfig {
  beat: string
  intensity?: number
  label?: string
}

export interface HapticConfig {
  patterns?: Record<string, string | PatternConfig>
  events?: Partial<Record<HapticEvent, string>>
  /** 'auto' | 'builtin' | 'external' | '<numeric device id>' */
  device?: string
}

export interface ResolvedPattern {
  beat: string
  intensity?: number
}
