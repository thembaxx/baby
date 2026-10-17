'use client';

export type HapticPatternType =
  | 'cry-detected'
  | 'timer-expired'
  | 'care-logged'
  | 'step-checked'
  | 'overdue-alert';

export type HapticIntensity = 'off' | 'gentle' | 'standard' | 'strong';

export interface HapticEventPayload {
  type: HapticPatternType;
  label: string;
  pattern: number[];
  timestamp: number;
}

const BASE_PATTERNS: Record<HapticPatternType, number[]> = {
  'cry-detected': [120, 70, 180, 70, 260],
  'timer-expired': [240, 100, 240, 100, 380],
  'care-logged': [35, 45, 70],
  'step-checked': [22],
  'overdue-alert': [160, 80, 160, 80, 160],
};

const INTENSITY_MULTIPLIER: Record<Exclude<HapticIntensity, 'off'>, number> = {
  gentle: 0.65,
  standard: 1.0,
  strong: 1.45,
};

/**
 * Plays a low-frequency 58 Hz tactile sub-bass pulse via Web Audio API
 * so devices without navigator.vibrate (e.g. iOS Safari or desktop) still
 * produce a physical speaker-cone tactile thump and audible/tactile cue.
 */
function playSubBassTactilePulse(
  pattern: number[],
  intensity: Exclude<HapticIntensity, 'off'>
) {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const gainScale =
      intensity === 'strong' ? 0.32 : intensity === 'standard' ? 0.2 : 0.1;

    let cursorMs = 0;
    for (let i = 0; i < pattern.length; i++) {
      const durationMs = pattern[i];
      const isVibratePhase = i % 2 === 0;
      if (isVibratePhase && durationMs > 0) {
        const startSec = ctx.currentTime + cursorMs / 1000;
        const endSec = startSec + durationMs / 1000;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(58, startSec);
        osc.frequency.exponentialRampToValueAtTime(42, endSec);

        gain.gain.setValueAtTime(0.001, startSec);
        gain.gain.linearRampToValueAtTime(gainScale, startSec + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, endSec);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startSec);
        osc.stop(endSec + 0.01);
      }
      cursorMs += durationMs;
    }

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, cursorMs + 150);
  } catch {
    // Ignore audio context restrictions if not triggered by user gesture
  }
}

export function triggerNurseryHaptic(
  type: HapticPatternType,
  options?: {
    intensity?: HapticIntensity;
    customLabel?: string;
    categoryHint?: string;
    onVisualPulse?: (payload: HapticEventPayload) => void;
  }
): HapticEventPayload | null {
  const intensity = options?.intensity ?? 'standard';
  if (intensity === 'off') return null;

  const mult = INTENSITY_MULTIPLIER[intensity];
  let rawPattern = BASE_PATTERNS[type] || BASE_PATTERNS['care-logged'];

  // Customize cry-detected cadence based on infant cry category
  if (type === 'cry-detected' && options?.categoryHint) {
    const cat = options.categoryHint.toLowerCase();
    if (cat.includes('hunger')) {
      // Rhythmic suckling cadence
      rawPattern = [110, 60, 110, 60, 220];
    } else if (cat.includes('gas') || cat.includes('colic')) {
      // Urgent double-burst abdominal tension cadence
      rawPattern = [180, 50, 180, 90, 300];
    } else if (cat.includes('overtired') || cat.includes('sleep')) {
      // Long, slow wave cadence
      rawPattern = [220, 120, 320];
    }
  }

  const scaledPattern = rawPattern.map((ms, idx) =>
    idx % 2 === 0 ? Math.max(15, Math.round(ms * mult)) : ms
  );

  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(scaledPattern);
    } catch {
      // Ignore vibration errors
    }
  }

  // Also emit subtle low-frequency tactile pulse for noisy rooms / non-vibrate devices
  playSubBassTactilePulse(scaledPattern, intensity);

  const defaultLabels: Record<HapticPatternType, string> = {
    'cry-detected': 'Cry Decoded — Haptic Alert Pulsed',
    'timer-expired': 'Soothing Timer Complete — Haptic Alert Pulsed',
    'care-logged': 'Care Log Updated — Tactile Confirmation',
    'step-checked': 'Soothing Step Checked',
    'overdue-alert': 'Feeding / Nap Window Due — Haptic Reminder',
  };

  const payload: HapticEventPayload = {
    type,
    label: options?.customLabel || defaultLabels[type],
    pattern: scaledPattern,
    timestamp: Date.now(),
  };

  options?.onVisualPulse?.(payload);
  return payload;
}
