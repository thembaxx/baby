'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Pill,
  Clock,
  Bell,
  BellRinging as BellRing,
  CheckCircle as CheckCircle2,
  Plus,
  Trash as Trash2,
  Vibrate,
  Warning as AlertTriangle,
  ArrowCounterClockwise as RotateCcw,
  ShieldCheck,
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'motion/react';
import {
  triggerNurseryHaptic,
  type HapticIntensity,
  type HapticEventPayload,
} from '@/lib/haptics';
import type { CaregiverRole } from '@/components/CaregiverHandoffCard';

import { useClientReady } from '@/hooks/use-client-ready';
import { readStoredValue } from '@/lib/storage';

export interface MedicationScheduleItem {
  id: string;
  name: string;
  dosage: string;
  frequencyHours: number;
  lastAdministeredTime: string;
  minutesSinceLastDose: number;
  lastAdministeredBy: string;
  dosesGivenToday: number;
  maxDailyDoses: number;
  instructions: string;
  recurringReminderEnabled: boolean;
  nextReminderSeconds: number;
  isDueAlertActive?: boolean;
}

interface MedicationLogCardProps {
  caregiverRole: CaregiverRole;
  hapticIntensity: HapticIntensity;
  onVisualPulse: (payload: HapticEventPayload) => void;
  onLogMedicationDose: (entry: {
    medicationName: string;
    dosage: string;
    frequencyHours: number;
    administeredBy: string;
    instructions: string;
    timestamp: string;
  }) => void;
}

// New installs never start with fabricated doses or pediatric prescription templates.
const INITIAL_MEDICATIONS: MedicationScheduleItem[] = [];

const ROLE_DISPLAY: Record<CaregiverRole, string> = {
  parent: 'Parent',
  grandparent: 'Grandparent',
  babysitter: 'Babysitter',
};

export function MedicationLogCard({
  caregiverRole,
  hapticIntensity,
  onVisualPulse,
  onLogMedicationDose,
}: MedicationLogCardProps) {
  const hasMounted = useClientReady();
  const [storedMedications, setMedications] = useState<
    MedicationScheduleItem[]
  >(() => readStoredValue('nocturne_medications_v1', INITIAL_MEDICATIONS));
  const medications = hasMounted ? storedMedications : INITIAL_MEDICATIONS;
  const [showAddForm, setShowAddForm] = useState(false);

  // Add Medication Form State
  const [newName, setNewName] = useState('');
  const [newDosage, setNewDosage] = useState('');
  const [newFrequencyHours, setNewFrequencyHours] = useState<number>(24);
  const [newMaxDaily, setNewMaxDaily] = useState<number>(1);
  const [newInstructions, setNewInstructions] = useState('');

  const saveMedications = useCallback((updated: MedicationScheduleItem[]) => {
    setMedications(updated);
    try {
      localStorage.setItem('nocturne_medications_v1', JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Notifications run in the browser timer, outside React's state updater.
  useEffect(() => {
    if (!hasMounted) return;
    const timer = setTimeout(() => {
      let changed = false;
      const nextList = medications.map((med) => {
        if (!med.recurringReminderEnabled) return med;

        // If countdown is running above 0, decrement by 1 second
        if (med.nextReminderSeconds > 0) {
          changed = true;
          const nextSecs = med.nextReminderSeconds - 1;

          // Increment minutesSinceLastDose every 60 seconds
          const addMinute = nextSecs % 60 === 0 ? 1 : 0;

          if (nextSecs === 0) {
            // Fire Recurring Medication Haptic Alert
            triggerNurseryHaptic('medication-due', {
              intensity: hapticIntensity,
              customLabel: `Medication Due: ${med.name} (${med.dosage}) — Every ${med.frequencyHours}h`,
              onVisualPulse,
            });

            return {
              ...med,
              nextReminderSeconds: 0,
              minutesSinceLastDose: med.minutesSinceLastDose + addMinute,
              isDueAlertActive: true,
            };
          }

          return {
            ...med,
            nextReminderSeconds: nextSecs,
            minutesSinceLastDose: med.minutesSinceLastDose + addMinute,
          };
        }

        return med;
      });

      if (changed) saveMedications(nextList);
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    hasMounted,
    medications,
    hapticIntensity,
    onVisualPulse,
    saveMedications,
  ]);

  const formatDurationFromMins = (mins: number) => {
    if (mins <= 0) return 'Just now';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m ago` : `${m}m ago`;
  };

  const formatCountdown = (totalSeconds: number) => {
    if (totalSeconds <= 0) return 'Due Now';
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    if (mins > 0) {
      return `${mins}m ${secs.toString().padStart(2, '0')}s`;
    }
    return `${secs}s`;
  };

  // Administer a dose now, reset last administered time, and automatically restart the recurring reminder cycle
  const handleAdministerDose = (med: MedicationScheduleItem) => {
    if (!window.confirm(`Confirm that ${med.dosage} of ${med.name} has already been administered, according to the clinician's instructions. This logs a past dose; it is not an instruction to give one.`)) return;
    const nowTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const caregiverName = ROLE_DISPLAY[caregiverRole];

    const updated = medications.map((item) =>
      item.id === med.id
        ? {
            ...item,
            lastAdministeredTime: nowTime,
            minutesSinceLastDose: 0,
            lastAdministeredBy: caregiverName,
            dosesGivenToday: Math.min(
              item.maxDailyDoses,
              item.dosesGivenToday + 1
            ),
            nextReminderSeconds: item.frequencyHours * 3600,
            isDueAlertActive: false,
          }
        : item
    );

    saveMedications(updated);

    triggerNurseryHaptic('care-logged', {
      intensity: hapticIntensity === 'off' ? 'standard' : hapticIntensity,
      customLabel: `Dose Logged: ${med.name} (${med.dosage}) · Next reminder in ${med.frequencyHours}h`,
      onVisualPulse,
    });

    onLogMedicationDose({
      medicationName: med.name,
      dosage: med.dosage,
      frequencyHours: med.frequencyHours,
      administeredBy: caregiverName,
      instructions: med.instructions,
      timestamp: nowTime,
    });
  };

  // Snooze recurring reminder for 15 minutes with tactile confirmation
  const handleSnoozeReminder = (med: MedicationScheduleItem, mins = 15) => {
    const updated = medications.map((item) =>
      item.id === med.id
        ? {
            ...item,
            recurringReminderEnabled: true,
            nextReminderSeconds: mins * 60,
            isDueAlertActive: false,
          }
        : item
    );
    saveMedications(updated);

    triggerNurseryHaptic('step-checked', {
      intensity: hapticIntensity === 'off' ? 'standard' : hapticIntensity,
      customLabel: `${med.name} reminder snoozed for ${mins} minutes`,
      onVisualPulse,
    });
  };

  // Start a 10-second live demo of the recurring reminder + haptic notification
  const handleStart10sDemoReminder = (med: MedicationScheduleItem) => {
    const updated = medications.map((item) =>
      item.id === med.id
        ? {
            ...item,
            recurringReminderEnabled: true,
            nextReminderSeconds: 10,
            isDueAlertActive: false,
          }
        : item
    );
    saveMedications(updated);

    triggerNurseryHaptic('step-checked', {
      intensity: hapticIntensity === 'off' ? 'standard' : hapticIntensity,
      customLabel: `10s Recurring Dose Timer started for ${med.name}`,
      onVisualPulse,
    });
  };

  const handleToggleRecurringReminder = (id: string) => {
    const target = medications.find((m) => m.id === id);
    const nextState = target ? !target.recurringReminderEnabled : true;

    const updated = medications.map((item) => {
      if (item.id !== id) return item;
      const fallbackSecs =
        item.nextReminderSeconds > 0
          ? item.nextReminderSeconds
          : item.frequencyHours * 3600;
      return {
        ...item,
        recurringReminderEnabled: nextState,
        nextReminderSeconds: fallbackSecs,
        isDueAlertActive: nextState ? item.isDueAlertActive : false,
      };
    });

    saveMedications(updated);

    if (target) {
      triggerNurseryHaptic('step-checked', {
        intensity: hapticIntensity,
        customLabel: `${target.name} recurring q${target.frequencyHours}h reminder ${
          nextState ? 'enabled' : 'paused'
        }`,
        onVisualPulse,
      });
    }
  };

  const handleDeleteMedication = (id: string) => {
    saveMedications(medications.filter((m) => m.id !== id));
  };

  const handleAddMedication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newDosage.trim() || !Number.isInteger(newMaxDaily) || newMaxDaily < 1 || newMaxDaily > 24) return;
    const created: MedicationScheduleItem = {
      id: `med-${Date.now()}`,
      name: newName.trim(),
      dosage: newDosage.trim(),
      frequencyHours: newFrequencyHours,
      lastAdministeredTime: 'Not logged',
      minutesSinceLastDose: 0,
      lastAdministeredBy: '—',
      dosesGivenToday: 0,
      maxDailyDoses: newMaxDaily,
      instructions: newInstructions.trim() || 'Confirm medication instructions with your healthcare professional.',
      recurringReminderEnabled: false,
      nextReminderSeconds: newFrequencyHours * 3600,
      isDueAlertActive: false,
    };
    saveMedications([created, ...medications]);
    setShowAddForm(false);
    triggerNurseryHaptic('care-logged', {
      intensity: hapticIntensity,
      customLabel: `Added ${created.name} to the log; no dose was recorded.`,
      onVisualPulse,
    });
  };

  const dueCount = medications.filter(
    (m) =>
      m.recurringReminderEnabled && (
        m.isDueAlertActive ||
        m.minutesSinceLastDose >= m.frequencyHours * 60 ||
        m.nextReminderSeconds === 0
      )
  ).length;

  return (
    <div className="p-6 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col gap-5">
      {/* Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
            <Pill className="w-5 h-5 text-[var(--accent-primary)]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Medication &amp; Supplement Log
              </h3>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  dueCount > 0
                    ? 'bg-amber-400/15 border-amber-400/40 text-[var(--accent-primary)]'
                    : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                }`}
              >
                {dueCount > 0
                  ? `${dueCount} Dose${dueCount > 1 ? 's' : ''} Due`
                  : 'No Reminders Due'}
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Caregiver-entered history and reminders only. Always confirm every dose with a clinician.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm((prev) => !prev)}
          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-amber-300 text-stone-950 text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{showAddForm ? 'Close Form' : 'Add Medication'}</span>
        </button>
      </div>

      {/* Add Medication Drawer */}
      <AnimatePresence initial={false}>
        {showAddForm && (
          <motion.form
            key="add-medication-form"
            initial={hasMounted ? { opacity: 0, y: -8 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            onSubmit={handleAddMedication}
            className="p-4 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] flex flex-col gap-3.5"
          >
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">Only enter medication and dosing details prescribed by your child&apos;s clinician or pharmacist. Saving a schedule does not log administration or activate reminders.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                  Medication / Drops Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Medication or supplement name"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                  Exact Dosage (mL / drops / mg)
                </label>
                <input
                  type="text"
                  value={newDosage}
                  onChange={(e) => setNewDosage(e.target.value)}
                  placeholder="As prescribed, including units"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                  Recurring Frequency
                </label>
                <select
                  value={newFrequencyHours}
                  onChange={(e) => {
                    const hrs = Number(e.target.value);
                    setNewFrequencyHours(hrs);

                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                >
                  <option value={2}>Every 2 hours (q2h)</option>
                  <option value={4}>Every 4 hours (q4h)</option>
                  <option value={6}>Every 6 hours (q6h)</option>
                  <option value={8}>Every 8 hours (q8h)</option>
                  <option value={12}>Every 12 hours (q12h)</option>
                  <option value={24}>Once Daily (Every 24h)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                Prescribed maximum doses per day
              </label>
              <input type="number" min={1} max={24} required value={newMaxDaily} onChange={event => setNewMaxDaily(Number(event.target.value))} className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                Caregiver Administration &amp; Safety Note
              </label>
              <input
                type="text"
                value={newInstructions}
                onChange={(e) => setNewInstructions(e.target.value)}
                placeholder="e.g. Give slowly into inner cheek with oral syringe after milk feed"
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3.5 py-2 rounded-xl border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-amber-300 text-stone-950 text-xs font-bold transition-colors"
              >
                Save Schedule — No Dose Logged
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Medication Cards List */}
      <div className="flex flex-col gap-3.5">
        {medications.length === 0 && <p role="status" className="text-sm text-[var(--text-secondary)] rounded-2xl bg-[var(--bg-canvas)] p-4">No medications logged. Only add a schedule supplied by a healthcare professional.</p>}
        <AnimatePresence initial={false}>
          {medications.map((med) => {
            const intervalMins = med.frequencyHours * 60;
            const isReadyOrDue = med.recurringReminderEnabled && (
              med.isDueAlertActive ||
              med.minutesSinceLastDose >= intervalMins ||
              med.nextReminderSeconds === 0
            );
            const minsUntilSafe = Math.max(
              0,
              intervalMins - med.minutesSinceLastDose
            );

            return (
              <motion.div
                layout={hasMounted}
                key={med.id}
                initial={hasMounted ? { opacity: 0, y: 10 } : false}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                className={`p-4 rounded-2xl border transition-colors flex flex-col gap-3 ${
                  isReadyOrDue
                    ? 'bg-amber-400/10 border-amber-400/45'
                    : 'bg-[var(--bg-canvas)] border-[var(--border-subtle)]'
                }`}
              >
                {/* Top Row: Name, Dosage Pill, Frequency Pill, Safety Badge */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-[var(--text-primary)]">
                        {med.name}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-mono font-bold text-[var(--accent-primary)]">
                        Dose: {med.dosage}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] font-mono text-[var(--text-secondary)]">
                        Every {med.frequencyHours}h
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {med.instructions}
                    </p>
                  </div>

                  {/* Dose Safety Guardrail Status */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isReadyOrDue ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-400/20 border border-amber-400/50 text-xs font-bold text-[var(--accent-primary)]">
                        <BellRing className="w-3.5 h-3.5 animate-bounce" />
                        <span>Reminder due — check instructions</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs font-semibold text-emerald-300">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>
                          Reminder in{' '}
                          {formatDurationFromMins(minsUntilSafe).replace(
                            ' ago',
                            ''
                          )}
                        </span>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteMedication(med.id)}
                      aria-label={`Remove ${med.name}`}
                      className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-rose-400 hover:bg-[var(--bg-surface)] transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Middle Telemetry Strip: Last Administered, Given By, Daily Cap, Next Recurring Haptic Reminder */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                      Last Administered
                    </span>
                    <span className="text-xs font-bold font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
                      {med.lastAdministeredTime}
                    </span>
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      {formatDurationFromMins(med.minutesSinceLastDose)}
                    </span>
                  </div>

                  <div className="px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                      Logged By
                    </span>
                    <span className="text-xs font-bold text-[var(--text-primary)] mt-0.5">
                      {med.lastAdministeredBy}
                    </span>
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      User entered
                    </span>
                  </div>

                  <div className="px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                      Configured daily limit
                    </span>
                    <span className="text-xs font-bold font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
                      {med.dosesGivenToday} / {med.maxDailyDoses} today
                    </span>
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      Verify against prescription
                    </span>
                  </div>

                  <div className="px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                      Recurring Haptic Alert
                    </span>
                    <span
                      className={`text-xs font-bold font-mono tabular-nums mt-0.5 ${
                        !med.recurringReminderEnabled
                          ? 'text-[var(--text-secondary)]'
                          : isReadyOrDue
                            ? 'text-[var(--accent-primary)]'
                            : 'text-emerald-300'
                      }`}
                    >
                      {!med.recurringReminderEnabled
                        ? 'Paused'
                        : formatCountdown(med.nextReminderSeconds)}
                    </span>
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      Auto-repeats q{med.frequencyHours}h
                    </span>
                  </div>
                </div>

                {/* Action Bar: Administer Dose, Recurring Toggle, Snooze, 10s Test Alert */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAdministerDose(med)}
                      className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                        isReadyOrDue
                          ? 'bg-[var(--accent-primary)] hover:bg-amber-300 text-stone-950 shadow-sm'
                          : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)]'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {isReadyOrDue
                          ? `Record ${med.dosage} Already Given`
                          : `Record ${med.dosage} Already Given`}
                      </span>
                    </button>

                    {isReadyOrDue && (
                      <button
                        type="button"
                        onClick={() => handleSnoozeReminder(med, 15)}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 transition-colors"
                      >
                        <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                        <span>Snooze 15m</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleToggleRecurringReminder(med.id)}
                      className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        med.recurringReminderEnabled
                          ? 'bg-[var(--bg-surface)] border-amber-400/30 text-[var(--text-primary)]'
                          : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <Bell className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      <span>
                        {med.recurringReminderEnabled
                          ? 'Recurring Alert: ON'
                          : 'Recurring Alert: OFF'}
                      </span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleStart10sDemoReminder(med)}
                      title="Start a 10-second countdown to feel the recurring medication haptic alert"
                      className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      <span>10s Alert Demo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        triggerNurseryHaptic('medication-due', {
                          intensity:
                            hapticIntensity === 'off'
                              ? 'standard'
                              : hapticIntensity,
                          customLabel: `Medication Haptic Test: ${med.name} (${med.dosage})`,
                          onVisualPulse,
                        })
                      }
                      title="Test medication haptic vibration pattern"
                      className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--accent-primary)] flex items-center gap-1 transition-colors"
                    >
                      <Vibrate className="w-3.5 h-3.5" />
                      <span>Feel Pulse</span>
                    </button>
                  </div>
                </div>

                {/* Overdue / Dose Ready Safety Notice */}
                {!isReadyOrDue && med.minutesSinceLastDose < intervalMins && (
                  <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)] pt-0.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      Double-Dose Protection: Last dose was given by{' '}
                      <strong className="text-[var(--text-primary)]">
                        {med.lastAdministeredBy}
                      </strong>{' '}
                      at {med.lastAdministeredTime}. Next recurring reminder
                      fires automatically.
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
