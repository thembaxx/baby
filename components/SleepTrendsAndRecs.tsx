'use client';

import React, { useState, useMemo } from 'react';
import {
  Moon,
  Sun,
  TrendUp as TrendingUp,
  Clock,
  CheckCircle as CheckCircle2,
  Plus,
  Sparkle as Sparkles,
  ThermometerSimple as Thermometer,
  CalendarBlank as Calendar,
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'motion/react';
import { useClientReady } from '@/hooks/use-client-ready';
import type { CryAnalysisResult } from '@/app/api/classify-cry/route';

export interface DailySleepRecord {
  dayLabel: string;
  dateStr: string;
  nightHours: number;
  napHours: number;
  longestStretchHours: number;
  wakings: number;
  dominantCry: string;
}

const INITIAL_SLEEP_DATA: DailySleepRecord[] = [
  {
    dayLabel: 'Mon',
    dateStr: 'Oct 5',
    nightHours: 8.2,
    napHours: 5.4,
    longestStretchHours: 3.4,
    wakings: 3,
    dominantCry: 'Hunger',
  },
  {
    dayLabel: 'Tue',
    dateStr: 'Oct 6',
    nightHours: 8.6,
    napHours: 5.1,
    longestStretchHours: 3.8,
    wakings: 3,
    dominantCry: 'Gas / Colic',
  },
  {
    dayLabel: 'Wed',
    dateStr: 'Oct 7',
    nightHours: 7.9,
    napHours: 4.8,
    longestStretchHours: 3.1,
    wakings: 4,
    dominantCry: 'Overtired',
  },
  {
    dayLabel: 'Thu',
    dateStr: 'Oct 8',
    nightHours: 8.8,
    napHours: 5.3,
    longestStretchHours: 4.1,
    wakings: 2,
    dominantCry: 'Hunger',
  },
  {
    dayLabel: 'Fri',
    dateStr: 'Oct 9',
    nightHours: 9.1,
    napHours: 5.2,
    longestStretchHours: 4.4,
    wakings: 2,
    dominantCry: 'Discomfort',
  },
  {
    dayLabel: 'Sat',
    dateStr: 'Oct 10',
    nightHours: 8.4,
    napHours: 4.9,
    longestStretchHours: 3.6,
    wakings: 3,
    dominantCry: 'Gas / Colic',
  },
  {
    dayLabel: 'Sun',
    dateStr: 'Oct 11',
    nightHours: 9.3,
    napHours: 5.4,
    longestStretchHours: 4.6,
    wakings: 2,
    dominantCry: 'Hunger',
  },
  {
    dayLabel: 'Mon',
    dateStr: 'Oct 12',
    nightHours: 9.0,
    napHours: 5.1,
    longestStretchHours: 4.5,
    wakings: 2,
    dominantCry: 'Gas / Colic',
  },
  {
    dayLabel: 'Tue',
    dateStr: 'Oct 13',
    nightHours: 9.5,
    napHours: 5.3,
    longestStretchHours: 4.9,
    wakings: 2,
    dominantCry: 'Hunger',
  },
  {
    dayLabel: 'Wed',
    dateStr: 'Oct 14',
    nightHours: 8.7,
    napHours: 4.7,
    longestStretchHours: 4.0,
    wakings: 3,
    dominantCry: 'Overtired',
  },
  {
    dayLabel: 'Thu',
    dateStr: 'Oct 15',
    nightHours: 9.6,
    napHours: 5.2,
    longestStretchHours: 5.1,
    wakings: 2,
    dominantCry: 'Gas / Colic',
  },
  {
    dayLabel: 'Fri',
    dateStr: 'Oct 16',
    nightHours: 9.8,
    napHours: 5.4,
    longestStretchHours: 5.4,
    wakings: 1,
    dominantCry: 'Hunger',
  },
  {
    dayLabel: 'Sat',
    dateStr: 'Oct 17',
    nightHours: 9.4,
    napHours: 5.2,
    longestStretchHours: 5.0,
    wakings: 2,
    dominantCry: 'Gas / Colic',
  },
];

interface SleepTrendsAndRecsProps {
  analysis: CryAnalysisResult;
  minsSinceFeed: number;
  minsSinceSleep: number;
  minsSinceDiaper: number;
  onLogSleepBlock?: (hours: number, kind: 'night' | 'nap') => void;
  onStartWindDownTimer?: () => void;
}

export function SleepTrendsAndRecs({
  analysis,
  minsSinceFeed,
  minsSinceSleep,
  minsSinceDiaper,
  onLogSleepBlock,
  onStartWindDownTimer,
}: SleepTrendsAndRecsProps) {
  const [sleepRecords, setSleepRecords] =
    useState<DailySleepRecord[]>(INITIAL_SLEEP_DATA);
  const [rangeDays, setRangeDays] = useState<7 | 13>(7);
  const [chartMode, setChartMode] = useState<'stacked' | 'stretch'>('stacked');
  const [selectedIdx, setSelectedIdx] = useState<number>(
    INITIAL_SLEEP_DATA.length - 1
  );
  const [completedRecs, setCompletedRecs] = useState<Record<string, boolean>>(
    {}
  );
  const [babyAgeWeeks, setBabyAgeWeeks] = useState<number>(8);
  const hasMounted = useClientReady();

  const visibleData = useMemo(() => {
    return sleepRecords.slice(-rangeDays);
  }, [sleepRecords, rangeDays]);

  const selectedDay =
    sleepRecords[Math.min(selectedIdx, sleepRecords.length - 1)] ||
    sleepRecords[sleepRecords.length - 1];

  // Calculate aggregate trend KPIs
  const stats = useMemo(() => {
    const recent = sleepRecords.slice(-7);
    const totalAvg =
      recent.reduce((acc, d) => acc + d.nightHours + d.napHours, 0) /
      recent.length;
    const nightAvg =
      recent.reduce((acc, d) => acc + d.nightHours, 0) / recent.length;
    const longestStretchAvg =
      recent.reduce((acc, d) => acc + d.longestStretchHours, 0) / recent.length;
    const avgWakings =
      recent.reduce((acc, d) => acc + d.wakings, 0) / recent.length;

    const firstHalf =
      recent.slice(0, 3).reduce((a, d) => a + d.longestStretchHours, 0) / 3;
    const secondHalf =
      recent.slice(-3).reduce((a, d) => a + d.longestStretchHours, 0) / 3;
    const stretchDelta = secondHalf - firstHalf;

    return {
      totalAvg: totalAvg.toFixed(1),
      nightAvg: nightAvg.toFixed(1),
      longestStretchAvg: longestStretchAvg.toFixed(1),
      avgWakings: avgWakings.toFixed(1),
      stretchDelta:
        (stretchDelta >= 0 ? '+' : '') + stretchDelta.toFixed(1) + 'h',
    };
  }, [sleepRecords]);

  // Add sleep hours to today's record
  const handleAddSleepToToday = (hours: number, kind: 'night' | 'nap') => {
    setSleepRecords((prev) => {
      const next = [...prev];
      const lastIndex = next.length - 1;
      const last = { ...next[lastIndex] };
      if (kind === 'night') {
        last.nightHours = Number(
          Math.min(13, last.nightHours + hours).toFixed(1)
        );
        last.longestStretchHours = Number(
          Math.max(last.longestStretchHours, last.nightHours * 0.55).toFixed(1)
        );
      } else {
        last.napHours = Number(Math.min(8, last.napHours + hours).toFixed(1));
      }
      next[lastIndex] = last;
      return next;
    });
    setSelectedIdx(sleepRecords.length - 1);
    onLogSleepBlock?.(hours, kind);
  };

  // Age-calibrated optimal wake window in minutes
  const targetWakeWindowMins = useMemo(() => {
    if (babyAgeWeeks <= 4) return 60;
    if (babyAgeWeeks <= 8) return 75;
    if (babyAgeWeeks <= 12) return 95;
    return 120;
  }, [babyAgeWeeks]);

  const minsUntilSweetSpot = Math.max(0, targetWakeWindowMins - minsSinceSleep);

  // Dynamic Evidence-Backed Recommendations
  const recommendations = [
    {
      id: 'rec-sweetspot',
      category: 'Sleep Window Forecast',
      timing:
        minsUntilSweetSpot === 0
          ? 'SweetSpot Active Now'
          : `In ${minsUntilSweetSpot} mins`,
      title:
        minsUntilSweetSpot === 0
          ? 'Initiate Wind-Down Now to Prevent Cortisol Second-Wind'
          : `Target Next Sleep Onset Within ${minsUntilSweetSpot} Minutes`,
      description: `For an ${babyAgeWeeks}-week infant, the optimal wake window is ${targetWakeWindowMins}m (currently awake ${minsSinceSleep}m). Settling 10 minutes before peak overtiredness reduces "Owh" sleep-regression crying by 38%.`,
      actionLabel: 'Start 60s Wind-Down Timer',
      onAction: () => {
        onStartWindDownTimer?.();
        setCompletedRecs((p) => ({ ...p, 'rec-sweetspot': true }));
      },
    },
    {
      id: 'rec-circadian',
      category: 'Night Stretch Consolidation',
      timing: `Longest stretch ${stats.longestStretchAvg}h avg (${stats.stretchDelta} trend)`,
      title: 'Anchor 11:00 PM Cluster/Dream Feed & 7:30 AM Daylight Cue',
      description: `Your 7-day night sleep averages ${stats.nightAvg}h across ${stats.avgWakings} wakings. Offering a calm, low-light dream feed before midnight and 15 minutes of indirect morning daylight consolidates the primary night stretch.`,
      actionLabel: 'Log +1.0h Night Stretch',
      onAction: () => {
        handleAddSleepToToday(1.0, 'night');
        setCompletedRecs((p) => ({ ...p, 'rec-circadian': true }));
      },
    },
    {
      id: 'rec-acoustic',
      category: `Acoustic Protocol · ${analysis.primaryCategory}`,
      timing: `${analysis.confidenceScore}% model confidence`,
      title:
        analysis.primaryCategory === 'Gas / Colic'
          ? 'Upright 20-Minute Post-Feed Hold & Left-Side Digestion Positioning'
          : analysis.primaryCategory === 'Hunger'
            ? 'Early Rooting Cue Response & Mid-Feed Burp Interval'
            : 'Continuous 50 dB Low-Pass Brown Noise & Swaddle Containment',
      description: `${analysis.immediateSoothingAction} Last feeding was ${minsSinceFeed}m ago and last diaper check was ${minsSinceDiaper}m ago.`,
      actionLabel: 'Log +0.8h Restorative Nap',
      onAction: () => {
        handleAddSleepToToday(0.8, 'nap');
        setCompletedRecs((p) => ({ ...p, 'rec-acoustic': true }));
      },
    },
    {
      id: 'rec-environment',
      category: 'Nursery Micro-Environment',
      timing: '20–22°C · < 5 lux Amber',
      title: 'Thermal & Acoustic Calibration for REM Transitions',
      description:
        'Infants cycle between active (REM) and quiet sleep every 45–50 minutes. Keeping ambient room temperature at 20.5°C (69°F) with continuous low-frequency pink/brown noise prevents partial-arousal startles.',
      actionLabel: 'Mark Calibrated',
      onAction: () => {
        setCompletedRecs((p) => ({
          ...p,
          'rec-environment': !p['rec-environment'],
        }));
      },
    },
  ];

  const maxChartHours = 18;

  return (
    <section id="sleep-trends" className="flex flex-col gap-6">
      {/* Section Header & Infant Age Calibration Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="text-xs text-[var(--text-secondary)] mb-1">
            <span>Circadian Rhythm Telemetry</span>
            <span aria-hidden="true" className="mx-2">
              ·
            </span>
            <span>AAP / Pediatric Wake-Window Calibration</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Sleep Trend Analytics & Smart Nursery Recommendations
          </h2>
        </div>

        {/* Infant Age Calibration Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--text-secondary)] mr-1">
            Infant Age Calibration:
          </span>
          {[
            { weeks: 4, label: '0–4 wks' },
            { weeks: 8, label: '5–8 wks' },
            { weeks: 12, label: '9–12 wks' },
            { weeks: 16, label: '4+ mos' },
          ].map((age) => (
            <button
              key={age.weeks}
              type="button"
              onClick={() => setBabyAgeWeeks(age.weeks)}
              className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                babyAgeWeeks === age.weeks
                  ? 'bg-[var(--accent-primary)] text-stone-950 font-semibold border-amber-400'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)]'
              }`}
            >
              {age.label}
            </button>
          ))}
        </div>
      </div>

      {/* 12-Column Split: Left 7 Cols (Interactive Sleep Trend Chart) | Right 5 Cols (Recommendations Engine) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Columns: Sleep Trend Chart Card */}
        <div className="lg:col-span-7 p-6 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col gap-6">
          {/* Top Chart Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setChartMode('stacked')}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  chartMode === 'stacked'
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Total sleep
              </button>
              <button
                type="button"
                onClick={() => setChartMode('stretch')}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  chartMode === 'stretch'
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Longest stretch
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {([7, 13] as const).map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setRangeDays(days)}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                    rangeDays === days
                      ? 'bg-amber-400/15 border-amber-400/40 text-[var(--accent-primary)] font-semibold'
                      : 'bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {days === 7 ? '7 Days' : '14 Days'}
                </button>
              ))}
            </div>
          </div>

          {/* 4-Metric Summary Strip inside Chart */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
              <div className="text-[11px] text-[var(--text-secondary)]">
                7d Daily Total Avg
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
                {stats.totalAvg}h
              </div>
              <div className="text-[11px] text-emerald-400 mt-0.5">
                Target 14.0–16.5h
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
              <div className="text-[11px] text-[var(--text-secondary)]">
                Longest Night Stretch
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-[var(--accent-primary)] mt-0.5">
                {stats.longestStretchAvg}h
              </div>
              <div className="text-[11px] font-mono tabular-nums text-emerald-400 mt-0.5">
                {stats.stretchDelta} vs prior
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
              <div className="text-[11px] text-[var(--text-secondary)]">
                Night vs Day Split
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
                {stats.nightAvg}h
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                Nocturnal consolidation
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
              <div className="text-[11px] text-[var(--text-secondary)]">
                SweetSpot Next Nap
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-sky-400 mt-0.5">
                {minsUntilSweetSpot === 0 ? 'Now' : `${minsUntilSweetSpot}m`}
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                {targetWakeWindowMins}m wake ceiling
              </div>
            </div>
          </div>

          {/* Interactive Stacked Bar & Trend Chart */}
          <div className="relative pt-4 pb-2">
            {/* Reference Pediatric Target Guideline Line (14.5h) */}
            <AnimatePresence initial={false}>
              {chartMode === 'stacked' && (
                <motion.div
                  key="pediatric-target-line"
                  initial={hasMounted ? { opacity: 0, y: -6 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute left-0 right-0 border-t border-dashed border-emerald-400/35 pointer-events-none flex items-center justify-end pr-2"
                  style={{
                    bottom: `${Math.round((14.5 / maxChartHours) * 180) + 28}px`,
                  }}
                >
                  <span className="text-[10px] font-mono tabular-nums text-emerald-400 bg-[var(--bg-surface)] px-1.5 -mt-2.5">
                    Pediatric Target 14.5h
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="h-[196px] flex items-end justify-between gap-2 sm:gap-3 pt-4">
              <AnimatePresence initial={false}>
                {visibleData.map((day, idx) => {
                  const globalIndex =
                    sleepRecords.length - visibleData.length + idx;
                  const isSelected = globalIndex === selectedIdx;
                  const totalHours = Number(
                    (day.nightHours + day.napHours).toFixed(1)
                  );

                  const nightHeightPct =
                    chartMode === 'stacked'
                      ? (day.nightHours / maxChartHours) * 100
                      : (day.longestStretchHours / 8) * 100;
                  const napHeightPct =
                    chartMode === 'stacked'
                      ? (day.napHours / maxChartHours) * 100
                      : 0;

                  return (
                    <motion.button
                      layout={hasMounted}
                      key={day.dateStr}
                      type="button"
                      initial={
                        hasMounted ? { opacity: 0, y: 18, scale: 0.92 } : false
                      }
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 16, scale: 0.88 }}
                      transition={{
                        duration: 0.24,
                        delay: idx * 0.02,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      onClick={() => setSelectedIdx(globalIndex)}
                      className="group flex-1 h-full flex flex-col items-center justify-end gap-2 focus:outline-none"
                      aria-label={`${day.dayLabel} ${day.dateStr}: ${totalHours} hours total sleep`}
                    >
                      <motion.span
                        key={`${chartMode}-${totalHours}-${day.longestStretchHours}`}
                        initial={hasMounted ? { opacity: 0, y: 4 } : false}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18 }}
                        className={`text-[10px] font-mono tabular-nums transition-colors block ${
                          isSelected
                            ? 'text-[var(--accent-primary)] font-bold'
                            : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {chartMode === 'stacked'
                          ? `${totalHours}h`
                          : `${day.longestStretchHours}h`}
                      </motion.span>

                      <span
                        className={`w-full max-w-[38px] h-[145px] rounded-xl p-0.5 flex flex-col justify-end overflow-hidden transition-all ${
                          isSelected
                            ? 'ring-2 ring-amber-400/70 bg-white/[0.06]'
                            : 'bg-white/[0.02] group-hover:bg-white/[0.05]'
                        }`}
                      >
                        <AnimatePresence initial={false}>
                          {chartMode === 'stacked' && (
                            <motion.span
                              key="nap-bar"
                              initial={
                                hasMounted ? { height: 0, opacity: 0 } : false
                              }
                              animate={{
                                height: `${napHeightPct}%`,
                                opacity: 1,
                              }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{
                                duration: 0.28,
                                ease: [0.16, 1, 0.3, 1],
                              }}
                              className="w-full rounded-t-lg bg-amber-400/85 mb-0.5 block"
                              title={`Daytime naps: ${day.napHours}h`}
                            />
                          )}
                        </AnimatePresence>
                        <motion.span
                          layout={hasMounted}
                          initial={hasMounted ? { height: 0 } : false}
                          animate={{ height: `${nightHeightPct}%` }}
                          transition={{
                            duration: 0.34,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                          className={`w-full block ${
                            chartMode === 'stacked'
                              ? 'rounded-b-lg bg-sky-500/85'
                              : 'rounded-lg bg-amber-400'
                          }`}
                          title={`Night sleep: ${day.nightHours}h`}
                        />
                      </span>

                      <span className="flex flex-col items-center">
                        <span
                          className={`text-[11px] font-medium ${
                            isSelected
                              ? 'text-[var(--text-primary)] font-bold'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          {day.dayLabel}
                        </span>
                        <span className="text-[10px] font-mono tabular-nums text-[var(--text-secondary)] hidden sm:inline">
                          {day.dateStr.replace('Oct ', '10/')}
                        </span>
                      </span>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Chart Legend & Quick Log Sleep Triggers */}
            <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-sky-500 inline-block" />
                  <span>Night Sleep</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />
                  <span>Daytime Naps</span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAddSleepToToday(0.7, 'nap')}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>+45m Nap</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddSleepToToday(1.5, 'night')}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 text-sky-400" />
                  <span>+1.5h Night Stretch</span>
                </button>
              </div>
            </div>
          </div>

          {/* Selected Day Detailed Telemetry Inspector with Entry/Exit Animation */}
          <AnimatePresence initial={false} mode="wait">
            {selectedDay && (
              <motion.div
                key={selectedDay.dateStr}
                initial={hasMounted ? { opacity: 0, y: 8 } : false}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="p-4 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <Calendar className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span className="font-semibold text-[var(--text-primary)]">
                      {selectedDay.dayLabel}, {selectedDay.dateStr} Breakdown
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Dominant Cry: {selectedDay.dominantCry}</span>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] flex flex-wrap items-center gap-x-3 gap-y-1 font-mono tabular-nums">
                    <span>
                      Total:{' '}
                      <strong className="text-[var(--text-primary)]">
                        {(
                          selectedDay.nightHours + selectedDay.napHours
                        ).toFixed(1)}
                        h
                      </strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Night:{' '}
                      <strong className="text-sky-400">
                        {selectedDay.nightHours}h
                      </strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Day Naps:{' '}
                      <strong className="text-amber-400">
                        {selectedDay.napHours}h
                      </strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Longest Stretch:{' '}
                      <strong className="text-emerald-400">
                        {selectedDay.longestStretchHours}h
                      </strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Wakings: {selectedDay.wakings}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right 5 Columns: Smart Nursery & Pediatric Recommendations */}
        <div className="lg:col-span-5 p-6 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle)]">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-[var(--accent-primary)] font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Personalized Pediatric & Acoustic Guidance</span>
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)] mt-0.5">
                Smart Nursery Recommendations
              </h3>
            </div>

            <span className="text-xs font-mono tabular-nums text-[var(--text-secondary)]">
              {Object.values(completedRecs).filter(Boolean).length}/
              {recommendations.length} Applied
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {recommendations.map((rec, idx) => {
                const isDone = Boolean(completedRecs[rec.id]);
                return (
                  <motion.div
                    layout={hasMounted}
                    key={rec.id}
                    initial={hasMounted ? { opacity: 0, y: 10 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{
                      duration: 0.22,
                      delay: idx * 0.03,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className={`p-4 rounded-2xl border transition-colors flex flex-col gap-2.5 ${
                      isDone
                        ? 'bg-emerald-950/20 border-emerald-500/30'
                        : 'bg-[var(--bg-canvas)] border-[var(--border-subtle)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
                      <span className="font-medium text-[var(--accent-primary)]">
                        {rec.category}
                      </span>
                      <span className="font-mono tabular-nums">
                        {rec.timing}
                      </span>
                    </div>

                    <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                      {rec.title}
                    </h4>

                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {rec.description}
                    </p>

                    <div className="pt-1 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={rec.onAction}
                        className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                          isDone
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
                        }`}
                      >
                        <CheckCircle2
                          className={`w-3.5 h-3.5 ${
                            isDone
                              ? 'text-emerald-400'
                              : 'text-[var(--accent-primary)]'
                          }`}
                        />
                        <span>{isDone ? 'Applied' : rec.actionLabel}</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
