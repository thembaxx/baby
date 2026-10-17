'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Check,
  Copy,
  RefreshCw,
  Plus,
  Clock,
  CheckCircle2,
  Sliders,
  Trash2,
  Sun,
  Moon,
  Sparkles,
  Share2,
  Smartphone,
  FileText,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CryRecorder, type CryPresetId } from '@/components/CryRecorder';
import { SoundscapePlayer } from '@/components/SoundscapePlayer';
import { AcousticOrb3D } from '@/components/AcousticOrb3D';
import { OfflineModelManager } from '@/components/OfflineModelManager';
import { VoiceControlBar } from '@/components/VoiceControlBar';
import { PWAInstallButton, OfflineIndicator } from '@/components/PWAInstallButton';
import { KoraLogo, type LogoVariant } from '@/components/KoraLogo';
import type { CryAnalysisResult } from '@/app/api/classify-cry/route';

type ThemeSetting = 'nocturne' | 'lunar' | 'daylight' | 'system';

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

  // Theme & Brand Logo Craft State
  const [themeSetting, setThemeSetting] = useState<ThemeSetting>('nocturne');
  const [resolvedTheme, setResolvedTheme] = useState<
    'nocturne' | 'lunar' | 'daylight'
  >('nocturne');
  const [logoVariant, setLogoVariant] = useState<LogoVariant>('polyhedron');

  // 3D & Audio Live State
  const [recState, setRecState] = useState({
    recording: false,
    analyzing: false,
    energy: 0.18,
  });
  const [externalPresetTrigger, setExternalPresetTrigger] = useState<{
    preset: CryPresetId;
    ts: number;
  } | null>(null);
  const [offlinePackReady, setOfflinePackReady] = useState(false);

  // Native Screen Wake Lock State
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const wakeLockSentinelRef = useRef<{ release: () => Promise<void> } | null>(
    null
  );
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  // Infant routine context counters (in minutes)
  const [minsSinceFeed, setMinsSinceFeed] = useState(136);
  const [minsSinceSleep, setMinsSinceSleep] = useState(68);
  const [minsSinceDiaper, setMinsSinceDiaper] = useState(151);

  // Quick Log Modal State
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

  // Synchronize Theme with DOM & Browser Meta Theme-Color (web.dev/learn/design/theming)
  useEffect(() => {
    const applyTheme = (mode: ThemeSetting) => {
      let actual: 'nocturne' | 'lunar' | 'daylight' = 'nocturne';
      if (mode === 'system') {
        const prefersLight = window.matchMedia(
          '(prefers-color-scheme: light)'
        ).matches;
        actual = prefersLight ? 'daylight' : 'nocturne';
      } else {
        actual = mode;
      }

      setResolvedTheme(actual);
      document.documentElement.setAttribute('data-theme', actual);

      const bgHex =
        actual === 'daylight'
          ? '#f5f2eb'
          : actual === 'lunar'
            ? '#090d16'
            : '#0c0a09';
      document.documentElement.style.backgroundColor = bgHex;
      document.body.style.backgroundColor = bgHex;

      // Update <meta name="theme-color"> for seamless mobile status bar & overscroll
      const metaTags = document.querySelectorAll('meta[name="theme-color"]');
      if (metaTags.length > 0) {
        metaTags.forEach((tag) => tag.setAttribute('content', bgHex));
      } else {
        const meta = document.createElement('meta');
        meta.name = 'theme-color';
        meta.content = bgHex;
        document.head.appendChild(meta);
      }
    };

    applyTheme(themeSetting);
  }, [themeSetting]);

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

  const saveLogs = useCallback((nextLogs: CareLogItem[]) => {
    setCareLogs(nextLogs);
    try {
      localStorage.setItem('nocturne_care_logs_v1', JSON.stringify(nextLogs));
    } catch {
      // Ignore storage errors
    }
  }, []);

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

  const handleClassificationResult = useCallback(
    (result: CryAnalysisResult) => {
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

      setCareLogs((prev) => {
        const updated = [newEntry, ...prev];
        try {
          localStorage.setItem(
            'nocturne_care_logs_v1',
            JSON.stringify(updated)
          );
        } catch {
          // Ignore storage errors
        }
        return updated;
      });
    },
    []
  );

  const handleRecordingStateChange = useCallback(
    (recording: boolean, analyzing: boolean, energy: number) => {
      setRecState({ recording, analyzing, energy });
    },
    []
  );

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

  const handleQuickResetCounter = useCallback(
    (type: 'feed' | 'diaper' | 'sleep') => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(15);
      }
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
    },
    [careLogs, saveLogs]
  );

  // Toggle Native Screen Wake Lock
  const toggleWakeLock = async () => {
    if (wakeLockActive) {
      await wakeLockSentinelRef.current?.release().catch(() => {});
      wakeLockSentinelRef.current = null;
      setWakeLockActive(false);
      return;
    }
    try {
      const navWithWakeLock = navigator as unknown as {
        wakeLock?: {
          request: (
            type: 'screen'
          ) => Promise<{ release: () => Promise<void> }>;
        };
      };
      if (navWithWakeLock.wakeLock) {
        const sentinel = await navWithWakeLock.wakeLock.request('screen');
        wakeLockSentinelRef.current = sentinel;
        setWakeLockActive(true);
      } else {
        setWakeLockActive(true);
      }
    } catch {
      setWakeLockActive(true);
    }
  };

  // Native Web Share API for Night Shift Summary
  const handleShareSummary = async () => {
    const summaryText = `Kora Nursery Summary: Latest Cry Decoded as ${analysis.primaryCategory} (${analysis.confidenceScore}% confidence). Action: ${analysis.immediateSoothingAction}. Last fed ${minsSinceFeed}m ago.`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Kora Nursery Night Shift Summary',
          text: summaryText,
          url: window.location.href,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    navigator.clipboard.writeText(summaryText);
    setShareFeedback('Summary copied');
    setTimeout(() => setShareFeedback(null), 2000);
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
    <div className="min-h-dvh bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col transition-colors">
      <OfflineIndicator />

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/90 backdrop-blur-md sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#studio"
          className="text-lg font-bold tracking-tight text-[var(--text-primary)] whitespace-nowrap shrink-0"
        >
          Kora
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[var(--text-secondary)]">
          <a
            href="#studio"
            className="hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
          >
            3D Studio
          </a>
          <a
            href="#decoder"
            className="hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
          >
            Cry Decoder
          </a>
          <a
            href="#care-log"
            className="hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
          >
            Nursery Log
          </a>
          <a
            href="#offline-llm"
            className="hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
          >
            Offline LLM
          </a>
          <a
            href="#ollama-setup"
            className="hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
          >
            Ollama Pipeline
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setShowQuickLogModal(true)}
            className="min-h-[40px] px-4 py-2 text-xs font-semibold text-stone-950 bg-[var(--accent-primary)] hover:opacity-95 rounded-xl transition-opacity whitespace-nowrap shrink-0"
          >
            Log Care Event
          </button>
        </div>
      </header>

      {/* Main 1440px Multi-Column Workspace */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 flex flex-col gap-8">
        {/* Brand Identity, Adaptive Theme Switcher & Native PWA Controls Bar */}
        <section
          id="studio"
          className="flex flex-col gap-6"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-5 border-b border-[var(--border-subtle)]">
            <div className="flex items-start sm:items-center gap-4">
              {/* Tactile Squircle Brand Emblem inspired by IMG_5047.jpeg */}
              <button
                type="button"
                onClick={() =>
                  setLogoVariant((prev) =>
                    prev === 'polyhedron'
                      ? 'lunar-wave'
                      : prev === 'lunar-wave'
                        ? 'acoustic-ring'
                        : 'polyhedron'
                  )
                }
                className="group relative rounded-2xl focus:outline-none shrink-0"
                title="Click to cycle Kora tactile squircle icon craft variants"
              >
                <KoraLogo variant={logoVariant} size={56} />
              </button>

              <div>
                <div className="text-xs text-[var(--text-secondary)] mb-1">
                  <span>Kora Acoustic Studio</span>
                  <span aria-hidden="true" className="mx-2">
                    ·
                  </span>
                  <span>Local Multimodal Infant Cry Analyzer</span>
                  <span aria-hidden="true" className="mx-2">
                    ·
                  </span>
                  <span className="font-mono text-[var(--accent-primary)]">
                    {offlinePackReady ? 'Offline Pack Ready' : 'WebGL 2.0 + PWA'}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
                  3D Infant Cry Acoustic Studio & Tactile Nursery Companion
                </h1>
              </div>
            </div>

            {/* Adaptive Theme Switcher + Native Device Utilities + PWA Install */}
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
                role="group"
                aria-label="Adaptive color theme selector"
              >
                {(
                  [
                    { id: 'nocturne', label: '3 AM Amber', icon: Moon },
                    { id: 'lunar', label: 'Lunar Dark', icon: Sparkles },
                    { id: 'daylight', label: 'Daylight', icon: Sun },
                  ] as const
                ).map((t) => {
                  const Icon = t.icon;
                  const active = themeSetting === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setThemeSetting(t.id)}
                      className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-[var(--accent-primary)] text-stone-950 font-semibold'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={toggleWakeLock}
                className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  wakeLockActive
                    ? 'bg-amber-400/15 border-amber-400/40 text-[var(--accent-primary)]'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title="Keep screen awake during 3:00 AM nursery care"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>{wakeLockActive ? 'Wake Lock On' : 'Keep Awake'}</span>
              </button>

              <button
                type="button"
                onClick={handleShareSummary}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Share2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>{shareFeedback || 'Share Shift'}</span>
              </button>

              <PWAInstallButton />
            </div>
          </div>

          {/* 4-Column Infant Routine Context Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-[var(--text-secondary)]">
                  Last Feeding
                </div>
                <div className="text-lg font-bold font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
                  {formatMins(minsSinceFeed)}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  {minsSinceFeed > 150
                    ? 'Elevated hunger likelihood'
                    : 'Within 2.5h comfort window'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleQuickResetCounter('feed')}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--accent-primary)] transition-colors whitespace-nowrap shrink-0"
              >
                Fed Now
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-[var(--text-secondary)]">
                  Current Wake Window
                </div>
                <div className="text-lg font-bold font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
                  {formatMins(minsSinceSleep)}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  {minsSinceSleep > 75
                    ? 'Approaching sleep threshold'
                    : 'Optimal alert window'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleQuickResetCounter('sleep')}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--accent-primary)] transition-colors whitespace-nowrap shrink-0"
              >
                Asleep Now
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-[var(--text-secondary)]">
                  Last Diaper Check
                </div>
                <div className="text-lg font-bold font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
                  {formatMins(minsSinceDiaper)}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  {minsSinceDiaper > 180
                    ? 'Check wetness indicator'
                    : 'Recently checked'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleQuickResetCounter('diaper')}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--accent-primary)] transition-colors whitespace-nowrap shrink-0"
              >
                Changed
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-[var(--text-secondary)]">
                  Cries Decoded Tonight
                </div>
                <div className="text-lg font-bold font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
                  {careLogs.filter((l) => l.type === 'cry').length} samples
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  Confidence{' '}
                  <span className="font-mono tabular-nums text-[var(--text-primary)]">
                    {analysis.confidenceScore}%
                  </span>
                </div>
              </div>
              <a
                href="/llm.txt"
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <FileText className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>llm.txt</span>
              </a>
            </div>
          </div>
        </section>

        {/* Primary 12-Column Split: Left (3D Interactive Sculpture + Recorder + Classification) | Right (Voice + Soundscape + Care Log) */}
        <div
          id="decoder"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        >
          {/* Left 7 Columns */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Three.js / WebGL 3D Interactive Acoustic Sculpture */}
            <AcousticOrb3D
              activeCategory={analysis.primaryCategory}
              confidenceScore={analysis.confidenceScore}
              isRecording={recState.recording}
              analyzing={recState.analyzing}
              audioEnergy={recState.energy}
              themeMode={resolvedTheme}
              onSelectCryNode={(preset) =>
                setExternalPresetTrigger({ preset, ts: Date.now() })
              }
            />

            {/* 5-Second Audio Recorder */}
            <CryRecorder
              onClassificationResult={handleClassificationResult}
              onRecordingStateChange={handleRecordingStateChange}
              externalPresetTrigger={externalPresetTrigger}
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
            <motion.div
              key={analysis.primaryCategory + analysis.confidenceScore}
              initial={{ opacity: 0.85, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="p-6 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col gap-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[var(--border-subtle)]">
                <div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    <span>Primary Classification</span>
                    <span aria-hidden="true" className="mx-2">
                      ·
                    </span>
                    <span className="font-mono tabular-nums text-[var(--text-primary)]">
                      {analysis.engineUsed === 'ollama-local'
                        ? `Ollama (${ollamaModel})`
                        : analysis.engineUsed === 'gemini-multimodal'
                          ? 'Gemini 3.8 Multimodal'
                          : 'Local Acoustic Formant'}
                    </span>
                    {analysis.latencyMs && (
                      <>
                        <span aria-hidden="true" className="mx-2">
                          ·
                        </span>
                        <span className="font-mono tabular-nums text-[var(--accent-primary)]">
                          {analysis.latencyMs}ms
                        </span>
                      </>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-[var(--text-primary)] mt-1">
                    {analysis.primaryCategory}
                  </h2>
                  {analysis.acousticSignature && (
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      {analysis.acousticSignature}
                    </p>
                  )}
                </div>

                <div className="flex flex-col sm:items-end shrink-0">
                  <span className="text-xs text-[var(--text-secondary)]">
                    Confidence Score
                  </span>
                  <span className="text-3xl font-bold font-mono tabular-nums text-[var(--accent-primary)]">
                    {analysis.confidenceScore}%
                  </span>
                </div>
              </div>

              {/* 4-Axis Probability Breakdown */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
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
                        label: 'Gas / Colic ("Eairh")',
                        val: analysis.probabilityBreakdown.gas,
                      },
                      {
                        key: 'hunger',
                        label: 'Hunger ("Neh")',
                        val: analysis.probabilityBreakdown.hunger,
                      },
                      {
                        key: 'overtired',
                        label: 'Overtired ("Owh")',
                        val: analysis.probabilityBreakdown.overtired,
                      },
                      {
                        key: 'discomfort',
                        label: 'Discomfort ("Heh")',
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
                        className="p-3.5 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span
                            className={
                              isTop
                                ? 'font-semibold text-[var(--accent-primary)]'
                                : 'text-[var(--text-primary)]'
                            }
                          >
                            {item.label}
                          </span>
                          <span className="font-mono tabular-nums font-semibold text-[var(--text-primary)]">
                            {item.val}%
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-stone-800/60 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{
                              width: `${Math.max(4, Math.min(100, item.val))}%`,
                            }}
                            transition={{
                              duration: 0.35,
                              ease: [0.16, 1, 0.3, 1],
                            }}
                            className={`h-full rounded-full ${
                              isTop
                                ? 'bg-[var(--accent-primary)]'
                                : 'bg-stone-500'
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Immediate Soothing Action & Interactive 60s Action Checklist */}
              <div className="p-5 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-[var(--accent-primary)]">
                      Immediate Soothing Action
                    </div>
                    <p className="text-sm font-medium text-[var(--text-primary)] mt-1">
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
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 text-xs font-semibold text-[var(--accent-primary)] flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
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
                  <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-col gap-2">
                    <div className="text-xs text-[var(--text-secondary)]">
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
                              ? 'bg-emerald-950/30 border-emerald-500/30 text-[var(--text-secondary)] line-through'
                              : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                          }`}
                        >
                          <CheckCircle2
                            className={`w-4 h-4 shrink-0 ${
                              done
                                ? 'text-emerald-400'
                                : 'text-[var(--text-secondary)]'
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
            </motion.div>
          </div>

          {/* Right 5 Columns: Voice Assistant + Soundscape + Nursery Log + Offline LLM */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Bidirectional Voice Control & Neural TTS */}
            <VoiceControlBar
              analysis={analysis}
              onTriggerPresetCry={(preset) =>
                setExternalPresetTrigger({ preset, ts: Date.now() })
              }
              onQuickLog={handleQuickResetCounter}
            />

            {/* Soundscape Synthesizer */}
            <div id="soundscape">
              <SoundscapePlayer />
            </div>

            {/* Nursery Care & Decode Log */}
            <div
              id="care-log"
              className="p-6 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col gap-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    Nursery Care & Cry Log
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Correlates feeding & sleep intervals with cry probabilities
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowQuickLogModal(true)}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>Add Entry</span>
                </button>
              </div>

              {/* Interactive Segmented Filter Controls */}
              <div className="flex items-center gap-1 p-1 bg-[var(--bg-canvas)] rounded-xl border border-[var(--border-subtle)]">
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
                        ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Log Items List */}
              <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
                {filteredLogs.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[var(--text-secondary)]">
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
                          <span className="font-semibold text-[var(--text-primary)] truncate">
                            {item.title}
                          </span>
                          <span
                            aria-hidden="true"
                            className="text-[var(--text-secondary)]"
                          >
                            ·
                          </span>
                          <span className="font-mono tabular-nums text-[var(--text-secondary)] shrink-0">
                            {item.timestamp}
                          </span>
                          {item.confidence !== undefined && (
                            <>
                              <span
                                aria-hidden="true"
                                className="text-[var(--text-secondary)]"
                              >
                                ·
                              </span>
                              <span className="font-mono tabular-nums text-[var(--accent-primary)] shrink-0">
                                {item.confidence}%
                              </span>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
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
                                : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                            }`}
                          >
                            {item.resolved ? 'Settled' : 'Mark Settled'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteLogItem(item.id)}
                          aria-label="Delete log entry"
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-rose-400 hover:bg-[var(--bg-canvas)] transition-colors"
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

        {/* Optional Offline On-Device LLM & Acoustic Weights Manager */}
        <section id="offline-llm">
          <OfflineModelManager
            onOfflineModelStatusChange={setOfflinePackReady}
          />
        </section>

        {/* Local Ollama & Vercel AI SDK Configuration Section */}
        <section
          id="ollama-setup"
          className="p-6 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col gap-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[var(--border-subtle)]">
            <div>
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] mb-1">
                <Sliders className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Local Hardware Inference Configuration</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-[var(--text-primary)]">
                  {ollamaStatus.online
                    ? 'Ollama Daemon Connected'
                    : 'Auto-Fallback Active'}
                </span>
              </div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                Ollama & Vercel AI SDK Local Audio Pipeline
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Configure your local OpenAI-compatible Ollama endpoint and keep
                multi-modal weights warm in memory for instant 3:00 AM cry
                checks.
              </p>
            </div>

            <button
              type="button"
              onClick={checkOllamaConnection}
              disabled={ollamaStatus.checking}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[var(--accent-primary)] ${
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
                <label className="text-xs font-medium text-[var(--text-primary)]">
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
                          ? 'bg-amber-400/15 border-amber-400/40 text-[var(--text-primary)]'
                          : 'bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
                    className="text-xs font-medium text-[var(--text-primary)]"
                  >
                    Ollama OpenAI Base URL
                  </label>
                  <input
                    id="ollama-url"
                    type="text"
                    value={ollamaBaseUrl}
                    onChange={(e) => setOllamaBaseUrl(e.target.value)}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-amber-400/50"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="ollama-model"
                    className="text-xs font-medium text-[var(--text-primary)]"
                  >
                    Multimodal Model Name
                  </label>
                  <input
                    id="ollama-model"
                    type="text"
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-amber-400/50"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] leading-relaxed">
                {ollamaStatus.online ? (
                  <span>
                    Connected to local Ollama at{' '}
                    <span className="font-mono text-[var(--text-primary)]">
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
              <div className="text-xs font-medium text-[var(--text-primary)]">
                Local Ollama Setup & Warm-Memory Commands
              </div>

              {[
                {
                  id: 'cmd-pull',
                  label:
                    '01. Pull multimodal audio model supporting base64/PCM input',
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
                  className="p-3.5 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] flex flex-col gap-2"
                >
                  <span className="text-xs text-[var(--text-secondary)]">
                    {item.label}
                  </span>
                  <div className="flex items-center justify-between gap-2 bg-[var(--bg-elevated)] px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)]">
                    <code className="text-xs font-mono text-[var(--accent-primary)] truncate">
                      {item.cmd}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyCommand(item.cmd, item.id)}
                      className="min-h-[32px] px-2.5 py-1 rounded-lg bg-[var(--bg-canvas)] hover:opacity-90 text-xs text-[var(--text-primary)] flex items-center gap-1.5 transition-opacity whitespace-nowrap shrink-0"
                    >
                      {copiedCmd === item.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
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
      <AnimatePresence>
        {showQuickLogModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md p-6 rounded-3xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-col gap-5 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Log Nursery Care Event
                </h3>
                <button
                  type="button"
                  onClick={() => setShowQuickLogModal(false)}
                  className="min-h-[36px] px-3 py-1 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
              </div>

              <form
                onSubmit={handleQuickLogSubmit}
                className="flex flex-col gap-4"
              >
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
                          ? 'bg-[var(--accent-primary)] text-stone-950 border-amber-400'
                          : 'bg-[var(--bg-canvas)] text-[var(--text-primary)] border-[var(--border-subtle)]'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="care-note"
                    className="text-xs font-medium text-[var(--text-primary)]"
                  >
                    Notes / Amount
                  </label>
                  <input
                    id="care-note"
                    type="text"
                    value={quickLogNote}
                    onChange={(e) => setQuickLogNote(e.target.value)}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-amber-400/50"
                  />
                </div>

                <button
                  type="submit"
                  className="min-h-[44px] w-full py-2.5 rounded-xl bg-[var(--accent-primary)] hover:opacity-95 text-stone-950 text-xs font-semibold transition-opacity"
                >
                  Save to Nursery Log
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quiet Footer */}
      <footer className="mt-auto border-t border-[var(--border-subtle)] py-6 px-6 text-center text-xs text-[var(--text-secondary)]">
        <span>Kora (Nocturne Cry)</span>
        <span aria-hidden="true" className="mx-2">
          ·
        </span>
        <span>3D WebGL Infant Cry Studio & Local Ollama PWA</span>
        <span aria-hidden="true" className="mx-2">
          ·
        </span>
        <a
          href="/llm.txt"
          className="hover:text-[var(--text-primary)] underline underline-offset-4"
        >
          llm.txt
        </a>
        <span aria-hidden="true" className="mx-2">
          ·
        </span>
        <span>github.com/thembaxx/baby</span>
      </footer>
    </div>
  );
}
