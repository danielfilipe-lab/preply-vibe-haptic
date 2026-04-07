#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const settingsPath = join(homedir(), '.claude', 'settings.json')
const claudeDir = join(homedir(), '.claude')

if (!existsSync(claudeDir)) mkdirSync(claudeDir, { recursive: true })

let settings: Record<string, unknown> = {}
if (existsSync(settingsPath)) {
  try { settings = JSON.parse(readFileSync(settingsPath, 'utf-8')) } catch {}
}

settings.enabledPlugins = {
  ...(settings.enabledPlugins as object ?? {}),
  'preply-vibe-haptic@preply-vibe-haptic': true,
}
settings.extraKnownMarketplaces = {
  ...(settings.extraKnownMarketplaces as object ?? {}),
  'preply-vibe-haptic': {
    source: { source: 'github', repo: 'danielfilipe-lab/preply-vibe-haptic' },
  },
}

writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n')
console.log('✓ Plugin registered in ~/.claude/settings.json')
console.log('  Restart Claude Code to activate.')
