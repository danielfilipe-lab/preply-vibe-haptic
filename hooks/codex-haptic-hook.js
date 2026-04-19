#!/usr/bin/env node
import { createRequire } from "node:module";
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// src/codex/hook.ts
import { appendFileSync } from "node:fs";
import { homedir as homedir2 } from "node:os";

// src/haptic.ts
import { createRequire as createRequire2 } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// src/config.ts
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
var DEFAULT_CONFIG = {
  patterns: {},
  events: {
    stop: "vibe",
    prompt: "alert"
  }
};
function getConfigPath(agent, scope) {
  const home = homedir();
  if (scope === "global") {
    if (agent === "opencode")
      return `${home}/.config/opencode/vibe-haptic.json`;
    if (agent === "codex")
      return `${home}/.codex/vibe-haptic.json`;
    return `${home}/.claude/vibe-haptic.json`;
  }
  if (agent === "opencode")
    return ".opencode/vibe-haptic.json";
  if (agent === "codex")
    return ".codex/vibe-haptic.json";
  return ".claude/vibe-haptic.json";
}
function mergeConfig(base, override) {
  return {
    patterns: { ...base.patterns, ...override.patterns },
    events: { ...base.events, ...override.events },
    device: override.device ?? base.device
  };
}
function loadConfig(agent = "claude") {
  let config = { ...DEFAULT_CONFIG };
  const globalPath = getConfigPath(agent, "global");
  if (existsSync(globalPath)) {
    try {
      const globalData = JSON.parse(readFileSync(globalPath, "utf-8"));
      config = mergeConfig(config, globalData);
    } catch {}
  } else if (agent === "codex") {
    const claudeGlobalPath = getConfigPath("claude", "global");
    if (existsSync(claudeGlobalPath)) {
      try {
        const claudeData = JSON.parse(readFileSync(claudeGlobalPath, "utf-8"));
        config = mergeConfig(config, claudeData);
      } catch {}
    }
  }
  const localPath = getConfigPath(agent, "local");
  if (existsSync(localPath)) {
    try {
      const localData = JSON.parse(readFileSync(localPath, "utf-8"));
      config = mergeConfig(config, localData);
    } catch {}
  }
  return config;
}

// src/patterns.ts
var DEFAULT_INTENSITY = 1;
var DEFAULT_PATTERNS = {
  vibe: { label: "Vibe       — soft-firm double", beat: "6/0.8 3/1.0   6/1.0" },
  knock: { label: "Knock      — two firm knocks", beat: "6/1.0  6/1.0" },
  thud: { label: "Thud       — single heavy hit", beat: "6/1.5" },
  confirm: { label: "Confirm    — soft then firm", beat: "4/0.6  6/1.0" },
  heartbeat: { label: "Heartbeat  — lub-dub pulse", beat: "6/0.4 6/1.0   6/0.4 6/1.0" },
  pulse: { label: "Pulse      — rising build-up", beat: "3/0.5 4/0.7 5/0.9 6/1.1" },
  dopamine: { label: "Dopamine   — reward burst", beat: "6666666 5/1.0 4/1.0 3/1.0", intensity: 0.1 },
  alert: { label: "Alert      — soft-hard-soft", beat: "6/0.5 6/1.0 6/0.5" },
  chirp: { label: "Chirp      — rising tap sequence", beat: "3/0.8 4/0.8 5/0.8 6/0.8" },
  tick: { label: "Tick       — single light tap", beat: "3/0.6" },
  noise: { label: "Noise      — rapid texture burst", beat: "6543654365436543" }
};
function resolvePattern(nameOrBeat, patterns) {
  const isInlineBeat = /^[3-6/.\s]+$/.test(nameOrBeat);
  if (isInlineBeat) {
    return { beat: nameOrBeat };
  }
  const userPattern = patterns?.[nameOrBeat];
  if (userPattern) {
    if (typeof userPattern === "string") {
      return { beat: userPattern };
    }
    return {
      beat: userPattern.beat,
      intensity: userPattern.intensity
    };
  }
  const defaultPattern = DEFAULT_PATTERNS[nameOrBeat];
  if (defaultPattern) {
    return {
      beat: defaultPattern.beat,
      intensity: defaultPattern.intensity
    };
  }
  return null;
}

// src/haptic.ts
var PAUSE_DELAY_MS = 100;
function parseBeat(beat, defaultIntensity) {
  const tokens = [];
  let i = 0;
  while (i < beat.length) {
    const char = beat[i];
    if (char === " ") {
      let pauseCount = 0;
      while (i < beat.length && beat[i] === " ") {
        pauseCount++;
        i++;
      }
      tokens.push({ type: "pause", pauseCount });
    } else if (char >= "3" && char <= "6") {
      const actuation = Number(char);
      i++;
      if (i < beat.length && beat[i] === "/") {
        i++;
        let intensityStr = "";
        while (i < beat.length && beat[i] !== " ") {
          intensityStr += beat[i];
          i++;
        }
        const intensity = intensityStr ? Math.min(2, Math.max(0, parseFloat(intensityStr))) : defaultIntensity;
        tokens.push({ type: "tap", actuation, intensity });
      } else {
        tokens.push({ type: "tap", actuation, intensity: defaultIntensity });
      }
    } else {
      i++;
    }
  }
  return tokens;
}

class HapticEngine {
  config;
  nativeModule = null;
  deviceId = null;
  constructor(config, options) {
    this.config = config;
    if (options?.nativeModule !== undefined) {
      this.nativeModule = options.nativeModule;
    } else {
      this.loadNativeModule();
    }
    this.deviceId = this.resolveDeviceId();
  }
  resolveDeviceId() {
    const preference = this.config.device ?? "auto";
    this.debug("resolveDeviceId", { preference, hasListDevices: !!this.nativeModule?.listDevices });
    if (preference === "auto" || !this.nativeModule?.listDevices)
      return null;
    const devices = this.nativeModule.listDevices();
    this.debug("listDevices result", devices.map((d) => ({ id: d.id.toString(), isBuiltin: d.isBuiltin })));
    let result = null;
    if (preference === "external")
      result = devices.find((d) => !d.isBuiltin)?.id ?? null;
    else if (preference === "builtin")
      result = devices.find((d) => d.isBuiltin)?.id ?? null;
    else
      try {
        result = BigInt(preference);
      } catch {
        result = null;
      }
    this.debug("resolved deviceId", result?.toString() ?? "null");
    return result;
  }
  debug(msg, data) {
    if (process.env.VIBE_HAPTIC_DEBUG !== "1")
      return;
    const { appendFileSync, existsSync: existsSync2, mkdirSync } = __require("node:fs");
    const { homedir: homedir2 } = __require("node:os");
    const logPath = `${homedir2()}/.preply-vibe-haptic-debug.log`;
    const line = `[haptic] ${msg}${data !== undefined ? ": " + JSON.stringify(data, (_, v) => typeof v === "bigint" ? v.toString() + "n" : v) : ""}
`;
    appendFileSync(logPath, line);
  }
  loadNativeModule() {
    if (process.platform !== "darwin") {
      return;
    }
    try {
      const currentDir = dirname(fileURLToPath(import.meta.url));
      const req = createRequire2(import.meta.url);
      const candidates = [
        join(currentDir, "..", "native", "preply-vibe-haptic-native.node"),
        join(currentDir, "..", "native", "vibe-haptic-native.node")
      ];
      for (const nativePath of candidates) {
        try {
          this.nativeModule = req(nativePath);
          this.debug("native module loaded", { path: nativePath, hasListDevices: !!this.nativeModule?.listDevices, hasActuateWithDeviceId: !!this.nativeModule?.actuateWithDeviceId });
          break;
        } catch {}
      }
      if (!this.nativeModule)
        throw new Error("no native module found");
    } catch (e) {
      this.debug("native module load failed", String(e));
    }
  }
  playBeat(pattern) {
    return new Promise((resolve) => {
      if (!this.nativeModule) {
        resolve();
        return;
      }
      const { beat, intensity } = pattern;
      const tokens = parseBeat(beat, intensity ?? DEFAULT_INTENSITY);
      const module = this.nativeModule;
      let i = 0;
      const playNext = () => {
        if (i >= tokens.length) {
          resolve();
          return;
        }
        const token = tokens[i];
        i++;
        if (token.type === "pause") {
          setTimeout(playNext, (token.pauseCount ?? 1) * PAUSE_DELAY_MS);
        } else {
          if (this.deviceId !== null && module.actuateWithDeviceId) {
            this.debug("actuating with device", { deviceId: this.deviceId.toString(), actuation: token.actuation, intensity: token.intensity });
            module.actuateWithDeviceId(this.deviceId, token.actuation, token.intensity);
          } else {
            this.debug("actuating via auto-select", { actuation: token.actuation, intensity: token.intensity });
            module.actuate(token.actuation, token.intensity);
          }
          playNext();
        }
      };
      playNext();
    });
  }
  trigger(patternName) {
    const pattern = resolvePattern(patternName, this.config.patterns);
    if (pattern) {
      return this.playBeat(pattern);
    }
    return Promise.resolve();
  }
  triggerForEvent(event) {
    const patternName = this.config.events?.[event];
    if (patternName) {
      return this.trigger(patternName);
    }
    return Promise.resolve();
  }
}
function createHapticEngine(agent) {
  return new HapticEngine(loadConfig(agent));
}

// src/codex/hook.ts
var DEBUG = process.env.VIBE_HAPTIC_DEBUG === "1";
function debug(message, data) {
  if (!DEBUG)
    return;
  const logPath = `${homedir2()}/.preply-vibe-haptic-debug.log`;
  const timestamp = new Date().toISOString();
  const logLine = data ? `[${timestamp}] [codex] ${message}: ${JSON.stringify(data, null, 2)}
` : `[${timestamp}] [codex] ${message}
`;
  appendFileSync(logPath, logLine);
}
async function handleHookEvent(input) {
  debug("handleHookEvent called", input);
  const engine = createHapticEngine("codex");
  if (input.hook_event_name === "Stop") {
    debug("Triggering stop event");
    await engine.triggerForEvent("stop");
  } else {
    debug("Unhandled hook event", { hook_event_name: input.hook_event_name });
  }
}
async function readStdin() {
  if (typeof Bun !== "undefined") {
    return Bun.stdin.text();
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    process.stdin.on("error", reject);
  });
}
async function main() {
  try {
    const input = await readStdin();
    const hookInput = JSON.parse(input);
    await handleHookEvent(hookInput);
    process.exit(0);
  } catch {
    process.exit(0);
  }
}

// src/bin/codex-haptic-hook.ts
main();
