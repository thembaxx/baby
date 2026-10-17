'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Check,
  Copy,
  RefreshCw,
  Plus,
  Clock,
  CheckCircle2,
  Sliders,
  Trash2,
} from 'lucide-react';
import { CryRecorder } from '@/components/CryRecorder';
import { SoundscapePlayer } from '@/components/SoundscapePlayer';
import type { CryAnalysisResult } from '@/app/api/classify-cry/route';

interface CareLogItem {
  id: string;
  type: 'cry' | 'feed' | 'diaper' | 'sleep';
  title: string;
  detail: string;
  timestamp: string;
  minutesAgo: number;
  confidence?: number;
  resolved?: boolean;
}

const INITIAL_LOGS: CareLogItem[] = [
  {
    id: 'log-1',
    type: 'cry',
    title: 'Gas / Colic Decoded',
    detail: 'Bicycle legs & tummy massage applied · Settled in 4m',
    timestamp: '02:14 AM',
    minutesAgo: 42,
    confidence: 84,
    resolved: true,
  },
  {
    id: 'log-2',
    type: 'feed',
    title: 'Paced Bottle Feed (110 ml)',
    detail: 'Expressed breastmilk · Upright burp completed',
    timestamp: '12:40 AM',
    minutesAgo: 136,
  },
  {
    id: 'log-3',
    type: 'diaper',
    title: 'Wet Diaper Changed',
    detail: 'Barrier cream applied · Normal output',
    timestamp: '12:25 AM',
    minutesAgo: 151,
  },
  {
    id: 'log-4',
    type: 'sleep',
    title: 'Night Sleep Stretch',
    detail: 'Duration 2h 55m · Womb brown noise active',
    timestamp: '09:30 PM',
    minutesAgo: 326,
  },
];

const INITIAL_ANALYSIS: CryAnalysisResult = {
  primaryCategory: 'Gas / Colic',
  confidenceScore: 84,
  probabilityBreakdown: {
    hunger: 12,
    gas: 74,
    overtired: 10,
    discomfort: 4,
  },
  immediateSoothingAction:
    'Apply gentle bicycle legs and counter-clockwise tummy massage.',
  acousticSignature:
    'High-tension "Eairh" strained abdominal resonance (~610 Hz peak) with constricted glottal pauses.',
  soothingSteps: [
    'Lay infant on back and slowly cycle legs in a bicycle motion for 60 seconds',
    'Use warm fingertips for gentle clockwise circles around the navel',
    'Hold in the "Colic Carry" (tummy-down along your forearm) with gentle patting',
  ],
  engineUsed: 'local-acoustic-fallback',
  modelName: 'qwen2-audio',
  latencyMs: 185,
};

export default function HomePage() {
  const [analysis, setAnalysis] = useState<CryAnalysisResult>(INITIAL_ANALYSIS);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>(
    {}
  );
  const [careLogs, setCareLogs] = useState<CareLogItem[]>(INITIAL_LOGS);
  const [logFilter, setLogFilter] = useState<
    'all' | 'cry' | 'feed' | 'diaper'
  >('all');

  // Infant routine context counters (in minutes)
  const [minsSinceFeed, setMinsSinceFeed] = useState(136);
  const [minsSinceSleep, setMinsSinceSleep] = useState(68);
  const [minsSinceDiaper, setMinsSinceDiaper] = useState(151);

  // Quick Log Modal / Form State
  const [showQuickLogModal, setShowQuickLogModal] = useState(false);
  const [quickLogType, setQuickLogType] = useState<'feed' | 'diaper' | 'sleep'>(
    'feed'
  );
  const [quickLogNote, setQuickLogNote] = useState('120 ml paced bottle feed');

  // Soothing step 60s timer
  const [soothingTimerSecs, setSoothingTimerSecs] = useState<number | null>(
    null
  );

  // Ollama Configuration State
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState(
    'http://localhost:11434/v1'
  );
  const [ollamaModel, setOllamaModel] = useState('qwen2-audio');
  const [inferenceMode, setInferenceMode] = useState<
    'auto' | 'ollama' | 'gemini'
  >('auto');
  const [ollamaStatus, setOllamaStatus] = useState<{
    checking: boolean;
    online: boolean;
    models: string[];
    message?: string;
  }>({
    checking: false,
    online: false,
    models: [],
  });
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // Load persisted logs from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('nocturne_care_logs_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCareLogs(parsed);
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const saveLogs = (nextLogs: CareLogItem[]) => {
    setCareLogs(nextLogs);
    try {
      localStorage.setItem('nocturne_care_logs_v1', JSON.stringify(nextLogs));
    } catch {
      // Ignore storage errors
    }
  };

  const checkOllamaConnection = useCallback(async () => {
    setOllamaStatus((prev) => ({ ...prev, checking: true }));
    try {
      const res = await fetch(
        `/api/classify-cry?baseUrl=${encodeURIComponent(ollamaBaseUrl)}`
      );
      const data = await res.json();
      setOllamaStatus({
        checking: false,
        online: Boolean(data.online),
        models: data.models || [],
        message: data.message,
      });
    } catch {
      setOllamaStatus({
        checking: false,
        online: false,
        models: [],
        message: 'Unable to reach local Ollama endpoint',
      });
    }
  }, [ollamaBaseUrl]);

  useEffect(() => {
    checkOllamaConnection();
  }, [checkOllamaConnection]);

  useEffect(() => {
    if (soothingTimerSecs === null) return;
    if (soothingTimerSecs <= 0) {
      setSoothingTimerSecs(null);
      return;
    }
    const timer = setTimeout(() => {
      setSoothingTimerSecs((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [soothingTimerSecs]);

  const handleClassificationResult = (result: CryAnalysisResult) => {
    setAnalysis(result);
    setCompletedSteps({});

    const nowTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const newEntry: CareLogItem = {
      id: `cry-${Date.now()}`,
      type: 'cry',
      title: `${result.primaryCategory} Decoded`,
      detail: result.immediateSoothingAction,
      timestamp: nowTime,
      minutesAgo: 0,
      confidence: result.confidenceScore,
      resolved: false,
    };

    saveLogs([newEntry, ...careLogs]);
  };

  const handleQuickLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nowTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const titleMap = {
      feed: 'Feeding Logged',
      diaper: 'Diaper Change Logged',
      sleep: 'Sleep Window Logged',
    };

    const newItem: CareLogItem = {
      id: `care-${Date.now()}`,
      type: quickLogType,
      title: titleMap[quickLogType],
      detail: quickLogNote.trim() || 'Routine nursery check completed',
      timestamp: nowTime,
      minutesAgo: 0,
    };

    if (quickLogType === 'feed') setMinsSinceFeed(0);
    if (quickLogType === 'diaper') setMinsSinceDiaper(0);
    if (quickLogType === 'sleep') setMinsSinceSleep(0);

    saveLogs([newItem, ...careLogs]);
    setShowQuickLogModal(false);
  };

  const handleQuickResetCounter = (type: 'feed' | 'diaper' | 'sleep') => {
    const nowTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (type === 'feed') {
      setMinsSinceFeed(0);
      saveLogs([
        {
          id: `feed-${Date.now()}`,
          type: 'feed',
          title: 'Feeding Completed',
          detail: 'Logged via 3:00 AM one-tap nursery counter',
          timestamp: nowTime,
          minutesAgo: 0,
        },
        ...careLogs,
      ]);
    } else if (type === 'diaper') {
      setMinsSinceDiaper(0);
      saveLogs([
        {
          id: `diaper-${Date.now()}`,
          type: 'diaper',
          title: 'Clean Diaper Change',
          detail: 'Logged via 3:00 AM one-tap nursery counter',
          timestamp: nowTime,
          minutesAgo: 0,
        },
        ...careLogs,
      ]);
    } else {
      setMinsSinceSleep(0);
      saveLogs([
        {
          id: `sleep-${Date.now()}`,
          type: 'sleep',
          title: 'Infant Settled to Sleep',
          detail: 'Wake window reset via nursery counter',
          timestamp: nowTime,
          minutesAgo: 0,
        },
        ...careLogs,
      ]);
    }
  };

  const toggleLogResolved = (id: string) => {
    const updated = careLogs.map((item) =>
      item.id === id ? { ...item, resolved: !item.resolved } : item
    );
    saveLogs(updated);
  };

  const deleteLogItem = (id: string) => {
    saveLogs(careLogs.filter((item) => item.id !== id));
  };

  const copyCommand = (cmd: string, id: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 1800);
  };

  const formatMins = (mins: number) => {
    if (mins === 0) return 'Just now';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m ago` : `${m}m ago`;
  };

  const filteredLogs = careLogs.filter((item) =>
    logFilter === 'all' ? true : item.type === logFilter
  );

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-white/[0.08] bg-stone-950/90 backdrop-blur-md sticky top-0 z-30">
        <a
          href="#decoder"
          className="text-lg font-bold tracking-tight text-stone-100 whitespace-nowrap shrink-0"
        >
          Nocturne Cry
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-400">
          <a
            href="#decoder"
            className="hover:text-stone-100 transition-colors whitespace-nowrap shrink-0"
          >
            Cry Decoder
          </a>
          <a
            href="#care-log"
            className="hover:text-stone-100 transition-colors whitespace-nowrap shrink-0"
          >
            Nursery Log
          </a>
          <a
            href="#soundscape"
            className="hover:text-stone-100 transition-colors whitespace-nowrap shrink-0"
          >
            Soundscape
          </a>
          <a
            href="#ollama-setup"
            className="hover:text-stone-100 transition-colors whitespace-nowrap shrink-0"
          >
            Ollama Pipeline
          </a>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setShowQuickLogModal(true)}
            className="min-h-[40px] px-4 py-2 text-xs font-semibold text-stone-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors whitespace-nowrap shrink-0"
          >
            Log Care Event
          </button>
        </div>
      </header>

      {/* Main 1440px Multi-Column Workspace */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        {/* Hero Context Header & 4-Column Infant Routine Strip */}
        <section className="flex flex-col gap-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="max-w-2xl">
              <div className="text-xs text-amber-300/90 font-medium mb-2">
                <span>Local Multimodal Infant Acoustics</span>
                <span aria-hidden="true" className="mx-2 text-stone-600">
                  ·
                </span>
                <span>Zero-Glare 3:00 AM Nursery Interface</span>
                <span aria-hidden="true" className="mx-2 text-stone-600">
                  ·
                </span>
                <span>Vercel AI SDK + Ollama</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-stone-100">
                Decode infant cry acoustics in 5 seconds without leaving your
                local network.
              </h1>
            </div>

            <div className="text-xs text-stone-400 flex items-center gap-2">
              <span>Active Engine:</span>
              <span className="font-mono text-stone-200">
                {analysis.engineUsed === 'ollama-local'
                  ? `Ollama Local (${ollamaModel})`
                  : analysis.engineUsed === 'gemini-multimodal'
                    ? 'Gemini 3.8 Flash Audio'
                    : `Local Acoustic Pipeline (${ollamaModel})`}
              </span>
              {analysis.latencyMs && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-amber-300">
                    {analysis.latencyMs}ms
                  </span>
                </>
              )}
            </div>
          </div>

          {/* 4-Column Routine Context Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-stone-400">Last Feeding</div>
                <div className="text-lg font-bold font-mono tabular-nums text-stone-100 mt-0.5">
                  {formatMins(minsSinceFeed)}
                </div>
                <div className="text-[11px] text-stone-400 mt-0.5">
                  {minsSinceFeed > 150
                    ? 'Elevated hunger likelihood'
                    : 'Within 2.5h comfort window'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleQuickResetCounter('feed')}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-white/[0.08] text-xs font-medium text-amber-300 transition-colors whitespace-nowrap shrink-0"
              >
                Fed Now
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-stone-400">Current Wake Window</div>
                <div className="text-lg font-bold font-mono tabular-nums text-stone-100 mt-0.5">
                  {formatMins(minsSinceSleep)}
                </div>
                <div className="text-[11px] text-stone-400 mt-0.5">
                  {minsSinceSleep > 75
                    ? 'Approaching sleep threshold'
                    : 'Optimal alert window'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleQuickResetCounter('sleep')}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-white/[0.08] text-xs font-medium text-amber-300 transition-colors whitespace-nowrap shrink-0"
              >
                Asleep Now
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-stone-400">Last Diaper Check</div>
                <div className="text-lg font-bold font-mono tabular-nums text-stone-100 mt-0.5">
                  {formatMins(minsSinceDiaper)}
                </div>
                <div className="text-[11px] text-stone-400 mt-0.5">
                  {minsSinceDiaper > 180
                    ? 'Check wetness indicator'
                    : 'Recently checked'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleQuickResetCounter('diaper')}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-white/[0.08] text-xs font-medium text-amber-300 transition-colors whitespace-nowrap shrink-0"
              >
                Changed
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-stone-400">
                  Cries Decoded Tonight
                </div>
                <div className="text-lg font-bold font-mono tabular-nums text-stone-100 mt-0.5">
                  {careLogs.filter((l) => l.type === 'cry').length} samples
                </div>
                <div className="text-[11px] text-stone-400 mt-0.5">
                  Avg confidence{' '}
                  <span className="font-mono tabular-nums text-stone-300">
                    {analysis.confidenceScore}%
                  </span>
                </div>
              </div>
              <a
                href="#care-log"
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-white/[0.08] text-xs font-medium text-stone-300 flex items-center transition-colors whitespace-nowrap shrink-0"
              >
                History
              </a>
            </div>
          </div>
        </section>

        {/* Primary 12-Column Split: Left (Cry Recorder + Structured Classification) | Right (Care Log + Soundscape) */}
        <div
          id="decoder"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        >
          {/* Left 7 Columns: Recorder & Classification Output */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <CryRecorder
              onClassificationResult={handleClassificationResult}
              careContext={{
                minutesSinceLastFeed: minsSinceFeed,
                minutesSinceLastSleep: minsSinceSleep,
                minutesSinceLastDiaper: minsSinceDiaper,
              }}
              ollamaConfig={{
                baseUrl: ollamaBaseUrl,
                model: ollamaModel,
                inferenceMode,
              }}
            />

            {/* Structured Cry Analysis Breakdown Card */}
            <div className="p-6 rounded-3xl bg-white/[0.04] border border-white/[0.08] flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
                <div>
                  <div className="text-xs text-stone-400">
                    Primary Classification
                    <span aria-hidden="true" className="mx-2 text-stone-600">
                      ·
                    </span>
                    <span className="font-mono tabular-nums text-stone-300">
                      Schema Verified
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-stone-100 mt-1">
                    {analysis.primaryCategory}
                  </h2>
                  {analysis.acousticSignature && (
                    <p className="text-xs text-stone-400 mt-1">
                      {analysis.acousticSignature}
                    </p>
                  )}
                </div>

                <div className="flex flex-col sm:items-end shrink-0">
                  <span className="text-xs text-stone-400">
                    Confidence Score
                  </span>
                  <span className="text-3xl font-bold font-mono tabular-nums text-amber-400">
                    {analysis.confidenceScore}%
                  </span>
                </div>
              </div>

              {/* 4-Axis Probability Breakdown */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs text-stone-400">
                  <span>Probability Breakdown</span>
                  <span className="font-mono tabular-nums">
                    Distribution (%)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(
                    [
                      {
                        key: 'gas',
                        label: 'Gas / Colic',
                        val: analysis.probabilityBreakdown.gas,
                      },
                      {
                        key: 'hunger',
                        label: 'Hunger ("Neh")',
                        val: analysis.probabilityBreakdown.hunger,
                      },
                      {
                        key: 'overtired',
                        label: 'Overtired / Sleep',
                        val: analysis.probabilityBreakdown.overtired,
                      },
                      {
                        key: 'discomfort',
                        label: 'Discomfort / Diaper',
                        val: analysis.probabilityBreakdown.discomfort,
                      },
                    ] as const
                  ).map((item) => {
                    const isTop =
                      item.val ===
                      Math.max(
                        analysis.probabilityBreakdown.gas,
                        analysis.probabilityBreakdown.hunger,
                        analysis.probabilityBreakdown.overtired,
                        analysis.probabilityBreakdown.discomfort
                      );
                    return (
                      <div
                        key={item.key}
                        className="p-3.5 rounded-2xl bg-stone-900/70 border border-white/[0.06] flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span
                            className={
                              isTop
                                ? 'font-semibold text-amber-300'
                                : 'text-stone-300'
                            }
                          >
                            {item.label}
                          </span>
                          <span className="font-mono tabular-nums font-semibold text-stone-200">
                            {item.val}%
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-stone-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isTop ? 'bg-amber-400' : 'bg-stone-500'
                            }`}
                            style={{
                              width: `${Math.max(4, Math.min(100, item.val))}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Immediate Soothing Action & Interactive 60s Action Checklist */}
              <div className="p-5 rounded-2xl bg-stone-900/90 border border-white/[0.08] flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium text-amber-300">
                      Immediate Soothing Action
                    </div>
                    <p className="text-sm font-medium text-stone-100 mt-1">
                      {analysis.immediateSoothingAction}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSoothingTimerSecs((prev) =>
                        prev === null ? 60 : null
                      )
                    }
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 text-xs font-semibold text-amber-300 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span className="font-mono tabular-nums">
                      {soothingTimerSecs !== null
                        ? `Soothing Timer: ${soothingTimerSecs}s`
                        : 'Start 60s Soothing Timer'}
                    </span>
                  </button>
                </div>

                {analysis.soothingSteps && analysis.soothingSteps.length > 0 && (
                  <div className="pt-3 border-t border-white/[0.06] flex flex-col gap-2">
                    <div className="text-xs text-stone-400">
                      Step-by-Step Soothing Protocol (Tap to check off)
                    </div>
                    {analysis.soothingSteps.map((step, idx) => {
                      const done = Boolean(completedSteps[idx]);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() =>
                            setCompletedSteps((prev) => ({
                              ...prev,
                              [idx]: !prev[idx],
                            }))
                          }
                          className={`min-h-[44px] px-3.5 py-2.5 rounded-xl border text-left text-xs flex items-center gap-3 transition-colors ${
                            done
                              ? 'bg-emerald-950/30 border-emerald-500/30 text-stone-300 line-through'
                              : 'bg-stone-950/60 hover:bg-stone-950 border-white/[0.06] text-stone-200'
                          }`}
                        >
                          <CheckCircle2
                            className={`w-4 h-4 shrink-0 ${
                              done ? 'text-emerald-400' : 'text-stone-500'
                            }`}
                          />
                          <span>
                            0{idx + 1}. {step}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right 5 Columns: Nursery Care Log & Soundscape Synthesizer */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Soundscape Synthesizer */}
            <div id="soundscape">
              <SoundscapePlayer />
            </div>

            {/* Nursery Care & Decode Log */}
            <div
              id="care-log"
              className="p-6 rounded-3xl bg-white/[0.04] border border-white/[0.08] flex flex-col gap-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-stone-100">
                    Nursery Care & Cry Log
                  </h3>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Correlates feeding & sleep intervals with cry probabilities
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowQuickLogModal(true)}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-white/[0.08] text-xs font-medium text-stone-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>Add Entry</span>
                </button>
              </div>

              {/* Interactive Segmented Filter Controls */}
              <div className="flex items-center gap-1 p-1 bg-stone-900 rounded-xl border border-white/[0.06]">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'cry', label: 'Cries' },
                    { id: 'feed', label: 'Feeds' },
                    { id: 'diaper', label: 'Diapers' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setLogFilter(tab.id)}
                    className={`flex-1 min-h-[36px] px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                      logFilter === tab.id
                        ? 'bg-stone-800 text-stone-100 shadow-sm'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Log Items List */}
              <div className="flex flex-col divide-y divide-white/[0.06]">
                {filteredLogs.length === 0 ? (
                  <div className="py-8 text-center text-xs text-stone-400">
                    No events logged in this category yet.
                  </div>
                ) : (
                  filteredLogs.slice(0, 7).map((item) => (
                    <div
                      key={item.id}
                      className="py-3.5 first:pt-1 last:pb-1 flex items-start justify-between gap-3"
                    >
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-stone-100 truncate">
                            {item.title}
                          </span>
                          <span aria-hidden="true" className="text-stone-600">
                            ·
                          </span>
                          <span className="font-mono tabular-nums text-stone-400 shrink-0">
                            {item.timestamp}
                          </span>
                          {item.confidence !== undefined && (
                            <>
                              <span
                                aria-hidden="true"
                                className="text-stone-600"
                              >
                                ·
                              </span>
                              <span className="font-mono tabular-nums text-amber-300 shrink-0">
                                {item.confidence}%
                              </span>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-stone-400 leading-relaxed">
                          {item.detail}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {item.type === 'cry' && (
                          <button
                            type="button"
                            onClick={() => toggleLogResolved(item.id)}
                            className={`min-h-[36px] px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                              item.resolved
                                ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
                                : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-white/[0.06]'
                            }`}
                          >
                            {item.resolved ? 'Settled' : 'Mark Settled'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteLogItem(item.id)}
                          aria-label="Delete log entry"
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-stone-500 hover:text-rose-400 hover:bg-stone-900 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Local Ollama & Vercel AI SDK Configuration Section */}
        <section
          id="ollama-setup"
          className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.08] flex flex-col gap-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
            <div>
              <div className="flex items-center gap-2 text-xs text-stone-400 mb-1">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>Local Hardware Inference Configuration</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-stone-300">
                  {ollamaStatus.online
                    ? 'Ollama Daemon Connected'
                    : 'Auto-Fallback Active'}
                </span>
              </div>
              <h2 className="text-lg font-bold text-stone-100">
                Ollama & Vercel AI SDK Local Audio Pipeline
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                Configure your local OpenAI-compatible Ollama endpoint and keep
                multi-modal weights warm in memory for instant 3:00 AM cry
                checks.
              </p>
            </div>

            <button
              type="button"
              onClick={checkOllamaConnection}
              disabled={ollamaStatus.checking}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-white/[0.08] text-xs font-medium text-stone-200 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-amber-400 ${
                  ollamaStatus.checking ? 'animate-spin' : ''
                }`}
              />
              <span>Test Local Ollama Connection</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 6 cols: Endpoint & Mode Settings */}
            <div className="lg:col-span-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-stone-300">
                  Inference Routing Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'auto', label: 'Auto (Ollama + Fallback)' },
                      { id: 'ollama', label: 'Ollama Local Only' },
                      { id: 'gemini', label: 'Gemini Cloud Audio' },
                    ] as const
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setInferenceMode(mode.id)}
                      className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap truncate ${
                        inferenceMode === mode.id
                          ? 'bg-amber-400/15 border-amber-400/40 text-amber-200'
                          : 'bg-stone-900/70 border-white/[0.07] text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="ollama-url"
                    className="text-xs font-medium text-stone-300"
                  >
                    Ollama OpenAI Base URL
                  </label>
                  <input
                    id="ollama-url"
                    type="text"
                    value={ollamaBaseUrl}
                    onChange={(e) => setOllamaBaseUrl(e.target.value)}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl bg-stone-900 border border-white/[0.08] text-xs font-mono text-stone-200 focus:outline-none focus:border-amber-400/50"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="ollama-model"
                    className="text-xs font-medium text-stone-300"
                  >
                    Multimodal Model Name
                  </label>
                  <input
                    id="ollama-model"
                    type="text"
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl bg-stone-900 border border-white/[0.08] text-xs font-mono text-stone-200 focus:outline-none focus:border-amber-400/50"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-stone-900/60 border border-white/[0.06] text-xs text-stone-400 leading-relaxed">
                {ollamaStatus.online ? (
                  <span>
                    Connected to local Ollama at{' '}
                    <span className="font-mono text-stone-200">
                      {ollamaBaseUrl}
                    </span>
                    . Installed models:{' '}
                    {ollamaStatus.models.length > 0
                      ? ollamaStatus.models.join(', ')
                      : 'none listed'}
                    .
                  </span>
                ) : (
                  <span>
                    {ollamaStatus.message ||
                      'Local Ollama daemon not currently detected on localhost:11434. Requests automatically route through the multimodal fallback so you can test immediately.'}
                  </span>
                )}
              </div>
            </div>

            {/* Right 6 cols: Terminal Setup Commands from Codex Spec */}
            <div className="lg:col-span-6 flex flex-col gap-3">
              <div className="text-xs font-medium text-stone-300">
                Local Ollama Setup & Warm-Memory Commands
              </div>

              {[
                {
                  id: 'cmd-pull',
                  label: '01. Pull multimodal audio model supporting base64/PCM input',
                  cmd: 'ollama pull qwen2-audio',
                },
                {
                  id: 'cmd-serve',
                  label:
                    '02. Keep model warm in RAM for 24h to prevent 3:00 AM cold-start latency',
                  cmd: 'OLLAMA_KEEP_ALIVE=24h ollama serve',
                },
              ].map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-stone-900/90 border border-white/[0.07] flex flex-col gap-2"
                >
                  <span className="text-xs text-stone-400">{item.label}</span>
                  <div className="flex items-center justify-between gap-2 bg-stone-950 px-3.5 py-2.5 rounded-xl border border-white/[0.06]">
                    <code className="text-xs font-mono text-amber-300 truncate">
                      {item.cmd}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyCommand(item.cmd, item.id)}
                      className="min-h-[32px] px-2.5 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 text-xs text-stone-300 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                    >
                      {copiedCmd === item.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-stone-400" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Quick Log Modal */}
      {showQuickLogModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-3xl bg-stone-900 border border-white/[0.1] flex flex-col gap-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-100">
                Log Nursery Care Event
              </h3>
              <button
                type="button"
                onClick={() => setShowQuickLogModal(false)}
                className="min-h-[36px] px-3 py-1 rounded-lg text-xs text-stone-400 hover:text-stone-200"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleQuickLogSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    {
                      id: 'feed',
                      label: 'Feeding',
                      defaultNote: '120 ml paced bottle feed',
                    },
                    {
                      id: 'diaper',
                      label: 'Diaper',
                      defaultNote: 'Wet diaper changed · Barrier cream',
                    },
                    {
                      id: 'sleep',
                      label: 'Sleep',
                      defaultNote: 'Swaddled in bassinet · Brown noise',
                    },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setQuickLogType(t.id);
                      setQuickLogNote(t.defaultNote);
                    }}
                    className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      quickLogType === t.id
                        ? 'bg-amber-400 text-stone-950 border-amber-400'
                        : 'bg-stone-950 text-stone-300 border-white/[0.08]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="care-note"
                  className="text-xs font-medium text-stone-300"
                >
                  Notes / Amount
                </label>
                <input
                  id="care-note"
                  type="text"
                  value={quickLogNote}
                  onChange={(e) => setQuickLogNote(e.target.value)}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-stone-950 border border-white/[0.08] text-xs text-stone-100 focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <button
                type="submit"
                className="min-h-[44px] w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-semibold transition-colors"
              >
                Save to Nursery Log
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Quiet Footer */}
      <footer className="mt-auto border-t border-white/[0.06] py-6 px-6 text-center text-xs text-stone-500">
        <span>Nocturne Cry</span>
        <span aria-hidden="true" className="mx-2">
          ·
        </span>
        <span>Local Infant Cry Classification Pipeline</span>
        <span aria-hidden="true" className="mx-2">
          ·
        </span>
        <span>Target Repository: github.com/thembaxx/baby</span>
      </footer>
    </div>
  );
}
