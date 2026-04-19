import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import type { HapticConfig, PatternConfig } from './types'

export type AgentType = 'claude' | 'opencode' | 'codex'

export const DEFAULT_CONFIG: HapticConfig = {
  patterns: {},
  events: {
    stop: 'vibe',
    prompt: 'alert',
  },
}

export function getConfigPath(agent: AgentType, scope: 'local' | 'global'): string {
  const home = homedir()

  if (scope === 'global') {
    if (agent === 'opencode') return `${home}/.config/opencode/vibe-haptic.json`
    if (agent === 'codex') return `${home}/.codex/vibe-haptic.json`
    return `${home}/.claude/vibe-haptic.json`
  }
  if (agent === 'opencode') return '.opencode/vibe-haptic.json'
  if (agent === 'codex') return '.codex/vibe-haptic.json'
  return '.claude/vibe-haptic.json'
}

function mergeConfig(base: HapticConfig, override: Partial<HapticConfig>): HapticConfig {
  return {
    patterns: { ...base.patterns, ...(override.patterns as Record<string, string | PatternConfig>) },
    events: { ...base.events, ...override.events },
    device: override.device ?? base.device,
  }
}

export function loadConfig(agent: AgentType = 'claude'): HapticConfig {
  let config: HapticConfig = { ...DEFAULT_CONFIG }

  const globalPath = getConfigPath(agent, 'global')
  if (existsSync(globalPath)) {
    try {
      const globalData = JSON.parse(readFileSync(globalPath, 'utf-8'))
      config = mergeConfig(config, globalData)
    } catch {}
  } else if (agent === 'codex') {
    // Codex falls back to Claude config when no Codex-specific config exists
    const claudeGlobalPath = getConfigPath('claude', 'global')
    if (existsSync(claudeGlobalPath)) {
      try {
        const claudeData = JSON.parse(readFileSync(claudeGlobalPath, 'utf-8'))
        config = mergeConfig(config, claudeData)
      } catch {}
    }
  }

  const localPath = getConfigPath(agent, 'local')
  if (existsSync(localPath)) {
    try {
      const localData = JSON.parse(readFileSync(localPath, 'utf-8'))
      config = mergeConfig(config, localData)
    } catch {}
  }

  return config
}
