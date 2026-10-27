"use client";

import React, { useState } from "react";
import {
  Handshake as HeartHandshake,
  PencilSimple as Edit3,
  Check,
  Phone,
  Baby,
  Clock,
  Sparkle as Sparkles,
} from "@phosphor-icons/react";

import { useClientReady } from "@/hooks/use-client-ready";
import { readStoredValue } from "@/lib/storage";
import { SpotlightCard } from "./easyui/SpotlightCard";

export type CaregiverRole = "parent" | "grandparent" | "babysitter";

interface CaregiverProfile {
  babyName: string;
  ageLabel: string;
  bottleInstructions: string;
  favoriteSoothing: string;
  emergencyContact: string;
}

const DEFAULT_PROFILE: CaregiverProfile = {
  babyName: "",
  ageLabel: "",
  bottleInstructions: "",
  favoriteSoothing: "",
  emergencyContact: "",
};

interface CaregiverHandoffCardProps {
  minsSinceFeed: number | null;
  minsSinceSleep: number | null;
  minsSinceDiaper: number | null;
}

export function CaregiverHandoffCard({
  minsSinceFeed,
  minsSinceSleep,
  minsSinceDiaper,
}: CaregiverHandoffCardProps) {
  const clientReady = useClientReady();
  const [storedProfile, setProfile] = useState<CaregiverProfile>(() =>
    readStoredValue("kora_caregiver_profile_v1", DEFAULT_PROFILE),
  );
  const profile = clientReady ? storedProfile : DEFAULT_PROFILE;
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditing(false);
    try {
      localStorage.setItem("kora_caregiver_profile_v1", JSON.stringify(profile));
    } catch {
      window.alert("Caregiver notes could not be saved. Keep a separate copy before closing.");
    }
  };

  return (
    <SpotlightCard className="p-5 sm:p-6 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col gap-5">
      {/* Baby profile and family handoff context */}
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
              Care notes {profile.babyName ? `for ${profile.babyName}` : "for your family"}
            </h2>
          </div>
        </div>
      </div>

      {/* Plain-English "What Baby Needs Next" Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-primary)]">
            <Clock className="w-4 h-4" />
            <span>Last recorded feeding</span>
          </div>
          <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5 tabular-nums">
            {minsSinceFeed === null ? "No dated feeding recorded" : `${minsSinceFeed} minutes ago`}
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
            Personal soothing notes
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
                <span>{isEditing ? "Cancel" : "Edit Notes"}</span>
              </button>
            </div>
            <p className="text-sm font-bold text-[var(--text-primary)] mt-1 tabular-nums">
              {profile.emergencyContact}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5 tabular-nums">
              {minsSinceSleep === null
                ? "No dated sleep recorded"
                : `Last recorded sleep ${minsSinceSleep}m ago`}{" "}
              ·{" "}
              {minsSinceDiaper === null
                ? "No dated diaper change recorded"
                : `Last recorded diaper ${minsSinceDiaper}m ago`}
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
            <label className="text-xs font-medium text-[var(--text-secondary)]">Baby Name</label>
            <input
              type="text"
              value={profile.babyName}
              onChange={(e) => setProfile({ ...profile, babyName: e.target.value })}
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
              onChange={(e) => setProfile({ ...profile, emergencyContact: e.target.value })}
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
              onChange={(e) => setProfile({ ...profile, bottleInstructions: e.target.value })}
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
              onChange={(e) => setProfile({ ...profile, favoriteSoothing: e.target.value })}
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
    </SpotlightCard>
  );
}
