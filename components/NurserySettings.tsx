'use client';

import {
  Desktop,
  Eye,
  Moon,
  Sparkle,
  Sun,
  Check,
  TextAa,
  Cube,
  DeviceMobile,
  Vibrate,
  CaretDown,
} from '@phosphor-icons/react';
import { motion } from 'motion/react';
import type { CaregiverRole } from './CaregiverHandoffCard';
import type { HapticIntensity } from '@/lib/haptics';

export type ThemeSetting =
  'nocturne' | 'redlight' | 'lunar' | 'daylight' | 'system';

const THEMES = [
  { id: 'nocturne', name: 'Night glow', detail: 'Warm & quiet', icon: Moon },
  { id: 'redlight', name: 'Red light', detail: 'A softer night', icon: Eye },
  { id: 'lunar', name: 'Lunar', detail: 'Cool & still', icon: Sparkle },
  { id: 'daylight', name: 'Daylight', detail: 'Light & clear', icon: Sun },
  {
    id: 'system',
    name: 'Automatic',
    detail: 'Match your device',
    icon: Desktop,
  },
] as const;

interface NurserySettingsProps {
  theme: ThemeSetting;
  onThemeChange: (theme: ThemeSetting) => void;
  caregiverRole: CaregiverRole;
  onRoleChange: (role: CaregiverRole) => void;
  largeText: boolean;
  onLargeTextChange: (value: boolean) => void;
  showVisualizer: boolean;
  onVisualizerChange: (value: boolean) => void;
  hapticIntensity: HapticIntensity;
  onHapticChange: (intensity: HapticIntensity) => void;
  wakeLockActive: boolean;
  wakeLockFeedback: string | null;
  onToggleWakeLock: () => void;
  onTestHaptic: () => void;
}

function SettingSwitch({
  title,
  description,
  checked,
  onChange,
  icon: Icon,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  icon: typeof TextAa;
}) {
  return (
    <div className="setting-row">
      <Icon size={22} className="setting-icon" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-label={title}
        aria-checked={checked}
        onClick={onChange}
        className="setting-switch"
      >
        <motion.span
          className="setting-switch-thumb"
          animate={{ x: checked ? 20 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  );
}

export function NurserySettings(props: NurserySettingsProps) {
  return (
    <>
      <section className="settings-section" aria-labelledby="appearance-title">
        <div className="settings-section-heading">
          <h2 id="appearance-title">Appearance</h2>
          <p>The right light for every little hour.</p>
        </div>
        <div className="theme-options" role="group" aria-label="Theme">
          {THEMES.map(({ id, name, detail, icon: Icon }) => (
            <motion.button
              key={id}
              type="button"
              className="theme-option"
              data-preview={id}
              aria-pressed={props.theme === id}
              onClick={() => props.onThemeChange(id)}
              whileTap={{ scale: 0.97 }}
            >
              <div className="theme-preview">
                <Icon
                  size={24}
                  weight={props.theme === id ? 'fill' : 'regular'}
                  aria-hidden="true"
                />
                <span className="theme-mini-nav">
                  <span />
                  <span />
                  <span />
                </span>
                {props.theme === id && (
                  <span className="theme-check">
                    <Check size={11} weight="regular" aria-hidden="true" />
                  </span>
                )}
              </div>
              <span className="theme-name">{name}</span>
              <span className="theme-description">{detail}</span>
            </motion.button>
          ))}
        </div>
      </section>

      <div className="settings-columns">
        <section className="settings-section" aria-labelledby="comfort-title">
          <div className="settings-section-heading">
            <h2 id="comfort-title">Comfort & accessibility</h2>
            <p>Small adjustments that make care easier.</p>
          </div>
          <label className="setting-row caregiver-select">
            <span className="flex-1">
              <span className="block font-semibold text-sm">
                Caregiver view
              </span>
              <span className="block text-xs text-[var(--text-secondary)] mt-1">
                Grandparent view uses larger text and hides the 3D orb.
              </span>
            </span>
            <span className="relative">
              <select
                value={props.caregiverRole}
                onChange={(event) =>
                  props.onRoleChange(event.target.value as CaregiverRole)
                }
                aria-label="Caregiver view"
              >
                <option value="parent">Parent</option>
                <option value="grandparent">Grandparent</option>
                <option value="babysitter">Babysitter</option>
              </select>
              <CaretDown
                size={14}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
            </span>
          </label>
          <SettingSwitch
            title="Larger text"
            description="A little more room to read."
            checked={props.largeText}
            onChange={() => props.onLargeTextChange(!props.largeText)}
            icon={TextAa}
          />
          <SettingSwitch
            title="3D sound visualizer"
            description="Explore cry patterns with the acoustic orb."
            checked={props.showVisualizer}
            onChange={() => props.onVisualizerChange(!props.showVisualizer)}
            icon={Cube}
          />
          <SettingSwitch
            title="Keep screen awake"
            description={
              props.wakeLockFeedback ||
              'While Kora is open and your device supports it.'
            }
            checked={props.wakeLockActive}
            onChange={props.onToggleWakeLock}
            icon={DeviceMobile}
          />
        </section>

        <section className="settings-section" aria-labelledby="haptics-title">
          <div className="settings-section-heading">
            <h2 id="haptics-title">Touch & alerts</h2>
            <p>A gentle nudge for care moments and timers.</p>
          </div>
          <div className="setting-row">
            <Vibrate size={22} className="setting-icon" aria-hidden="true" />
            <div>
              <h3>Vibration strength</h3>
              <p>Choose what feels comfortable.</p>
            </div>
          </div>
          <div
            className="haptic-options"
            role="group"
            aria-label="Vibration strength"
          >
            {(['off', 'gentle', 'standard', 'strong'] as const).map(
              (intensity) => (
                <button
                  key={intensity}
                  type="button"
                  aria-pressed={props.hapticIntensity === intensity}
                  onClick={() => props.onHapticChange(intensity)}
                >
                  {intensity}
                </button>
              )
            )}
          </div>
          <button
            type="button"
            className="quiet-action haptic-preview"
            onClick={props.onTestHaptic}
            disabled={props.hapticIntensity === 'off'}
          >
            <Vibrate size={18} aria-hidden="true" />
            Preview vibration
          </button>
          <p className="settings-help">
            Motion follows your device’s Reduce Motion preference.
          </p>
        </section>
      </div>
    </>
  );
}
