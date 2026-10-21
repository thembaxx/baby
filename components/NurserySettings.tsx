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
import { AnimatedTabs } from './easyui/AnimatedTabs';
import { UnfoldAccordion } from './easyui/UnfoldAccordion';
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
          <AnimatedTabs
            label="Vibration strength"
            items={[{ id: 'off', label: 'Off' }, { id: 'gentle', label: 'Gentle' }, { id: 'standard', label: 'Standard' }, { id: 'strong', label: 'Strong' }]}
            value={props.hapticIntensity}
            onChange={value => props.onHapticChange(value as HapticIntensity)}
          />
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
      <section className="settings-section" aria-label="About Kora">
        <UnfoldAccordion title="Privacy, model limits & safe use">
          <p>Kora is an experimental care journal, not a medical device. Cry categories and percentages are not clinically validated diagnoses. Check your baby directly, and contact a healthcare professional for concerns or urgent symptoms.</p>
          <p>Care notes stay in this browser’s local storage. Audio is sent to a configured inference service only when you request analysis; an unavailable model cannot provide a real cry analysis.</p>
        </UnfoldAccordion>
      </section>
    </>
  );
}
