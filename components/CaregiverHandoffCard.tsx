'use client';

import React, { useState, useEffect } from 'react';
import { HeartHandshake, Edit3, Check, Phone, Baby, Clock, Sparkles } from 'lucide-react';

export type CaregiverRole = 'parent' | 'grandparent' | 'babysitter';

interface CaregiverProfile {
  babyName: string;
  ageLabel: string;
  bottleInstructions: string;
  favoriteSoothing: string;
  emergencyContact: string;
}

const DEFAULT_PROFILE: CaregiverProfile = {
  babyName: 'Maya',
  ageLabel: '8 weeks old',
  bottleInstructions: '120 ml (4 oz) warm breastmilk or formula · Burp halfway through',
  favoriteSoothing: 'Hold upright on left shoulder + play Womb Brown Noise',
  emergencyContact: 'Mom & Dad · (555) 234-8910',
};

interface CaregiverHandoffCardProps {
  role: CaregiverRole;
  onRoleChange: (role: CaregiverRole) => void;
  largeText: boolean;
  onToggleLargeText: () => void;
  minsSinceFeed: number;
  minsSinceSleep: number;
  minsSinceDiaper: number;
}

export function CaregiverHandoffCard({
  role,
  onRoleChange,
  largeText,
  onToggleLargeText,
  minsSinceFeed,
  minsSinceSleep,
  minsSinceDiaper,
}: CaregiverHandoffCardProps) {
  const [profile, setProfile] = useState<CaregiverProfile>(DEFAULT_PROFILE);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('kora_caregiver_profile_v1');
      if (saved) {
        setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(saved) });
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditing(false);
    try {
      localStorage.setItem('kora_caregiver_profile_v1', JSON.stringify(profile));
    } catch {
      // Ignore storage errors
    }
  };

  const nextFeedInMins = Math.max(0, 180 - minsSinceFeed);
  const nextNapInMins = Math.max(0, 75 - minsSinceSleep);

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col gap-5">
      {/* Top Row: Who is caring for baby + Large Text Accessibility Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center shrink-0">
            <Baby className="w-6 h-6 text-[var(--accent-primary)]" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span>Caregiver Guide</span>
              <span aria-hidden="true">·</span>
              <span>{profile.ageLabel}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
              Caring for {profile.babyName} Right Now
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Role Switcher: Parent | Grandparent | Babysitter */}
          <div
            className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)]"
            role="group"
            aria-label="Select who is caring for the baby"
          >
            {(
              [
                { id: 'parent', label: 'Parent View' },
                { id: 'grandparent', label: 'Grandparent View' },
                { id: 'babysitter', label: 'Babysitter View' },
              ] as const
            ).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  onRoleChange(r.id);
                  if (r.id === 'grandparent' && !largeText) {
                    onToggleLargeText();
                  }
                }}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  role === r.id
                    ? 'bg-[var(--accent-primary)] text-stone-950'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleLargeText}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              largeText
                ? 'bg-amber-400/20 border-amber-400/50 text-[var(--accent-primary)]'
                : 'bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-primary)]'
            }`}
          >
            {largeText ? 'Large Text: ON' : 'Large Easy-Read Text'}
          </button>
        </div>
      </div>

      {/* Plain-English "What Baby Needs Next" Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-primary)]">
            <Clock className="w-4 h-4" />
            <span>Next Feeding Window</span>
          </div>
          <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5 tabular-nums">
            {nextFeedInMins === 0
              ? 'Ready for a feed now'
              : `In about ${nextFeedInMins} minutes`}
          </p>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {profile.bottleInstructions}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400">
            <Sparkles className="w-4 h-4" />
            <span>What Calms {profile.babyName} Best</span>
          </div>
          <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
            Works 9 out of 10 times
          </p>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {profile.favoriteSoothing}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] flex flex-col justify-between gap-2">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <Phone className="w-3.5 h-3.5" />
                <span>Parent / Family Contact</span>
              </span>
              <button
                type="button"
                onClick={() => setIsEditing((prev) => !prev)}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1"
              >
                <Edit3 className="w-3 h-3" />
                <span>{isEditing ? 'Cancel' : 'Edit Notes'}</span>
              </button>
            </div>
            <p className="text-sm font-bold text-[var(--text-primary)] mt-1 tabular-nums">
              {profile.emergencyContact}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5 tabular-nums">
              Next nap in ~{nextNapInMins}m · Last diaper {minsSinceDiaper}m ago
            </p>
          </div>
        </div>
      </div>

      {/* Inline Editor for Baby Notes */}
      {isEditing && (
        <form
          onSubmit={handleSave}
          className="p-4 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              Baby Name
            </label>
            <input
              type="text"
              value={profile.babyName}
              onChange={(e) =>
                setProfile({ ...profile, babyName: e.target.value })
              }
              className="min-h-[42px] px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              Parent / Emergency Phone
            </label>
            <input
              type="text"
              value={profile.emergencyContact}
              onChange={(e) =>
                setProfile({ ...profile, emergencyContact: e.target.value })
              }
              className="min-h-[42px] px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              Feeding / Bottle Instructions
            </label>
            <input
              type="text"
              value={profile.bottleInstructions}
              onChange={(e) =>
                setProfile({ ...profile, bottleInstructions: e.target.value })
              }
              className="min-h-[42px] px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              Favorite Soothing Trick
            </label>
            <input
              type="text"
              value={profile.favoriteSoothing}
              onChange={(e) =>
                setProfile({ ...profile, favoriteSoothing: e.target.value })
              }
              className="min-h-[42px] px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end pt-1">
            <button
              type="submit"
              className="min-h-[42px] px-5 py-2 rounded-xl bg-[var(--accent-primary)] text-stone-950 text-xs font-bold flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Save Caregiver Instructions</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
