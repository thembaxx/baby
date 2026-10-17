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
  Volume2,
  ChevronDown,
  ChevronUp,
  Vibrate,
  BellRing,
  Eye,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CryRecorder, type CryPresetId } from '@/components/CryRecorder';
import { SoundscapePlayer } from '@/components/SoundscapePlayer';
import { AcousticOrb3D } from '@/components/AcousticOrb3D';
import { OfflineModelManager } from '@/components/OfflineModelManager';
import { VoiceControlBar } from '@/components/VoiceControlBar';
import { PWAInstallButton, OfflineIndicator } from '@/components/PWAInstallButton';
import { KoraLogo, type LogoVariant } from '@/components/KoraLogo';
import { SleepTrendsAndRecs } from '@/components/SleepTrendsAndRecs';
import {
  CaregiverHandoffCard,
  type CaregiverRole,
} from '@/components/CaregiverHandoffCard';
import { MedicationLogCard } from '@/components/MedicationLogCard';
import {
  triggerNurseryHaptic,
  type HapticIntensity,
  type HapticEventPayload,
} from '@/lib/haptics';
import type { CryAnalysisResult } from '@/app/api/classify-cry/route';

type ThemeSetting = 'nocturne' | 'redlight' | 'lunar' | 'daylight' | 'system';

interface CareLogItem {
  id: string;
  type: 'cry' | 'feed' | 'diaper' | 'sleep' | 'medication';
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
    title: 'Tummy Gas / Colic Translated',
    detail: 'Bicycle legs & tummy massage applied · Settled in 4 mins',
    timestamp: '02:14 AM',
    minutesAgo: 42,
    confidence: 84,
    resolved: true,
  },
  {
    id: 'log-2',
    type: 'feed',
    title: 'Bottle Feed (110 ml / 3.7 oz)',
    detail: 'Warm milk · Burped upright on shoulder',
    timestamp: '12:40 AM',
    minutesAgo: 136,
  },
  {
    id: 'log-3',
    type: 'diaper',
    title: 'Wet Diaper Changed',
    detail: 'Diaper cream applied · Clean & comfortable',
    timestamp: '12:25 AM',
    minutesAgo: 151,
  },
  {
    id: 'log-4',
    type: 'sleep',
    title: 'Night Sleep Stretch',
    detail: 'Slept 2h 55m · Womb brown noise playing',
    timestamp: '09:30 PM',
    minutesAgo: 326,
  },
  {
    id: 'log-5',
    type: 'medication',
    title: 'Simethicone Gas Drops (0.3 mL)',
    detail: 'Every 4h schedule · Logged by Parent · Next reminder active',
    timestamp: '11:30 PM',
    minutesAgo: 225,
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
    'Tight tummy sound ("Eairh" pattern) — baby likely needs help passing a burp or gas bubble.',
  soothingSteps: [
    'Lay baby gently on their back and slowly pedal their legs like a bicycle for 60 seconds',
    'Use warm fingertips to trace slow, gentle circles around the belly button',
    'Hold baby upright against your shoulder or tummy-down along your forearm and pat gently',
  ],
  engineUsed: 'local-acoustic-fallback',
  modelName: 'qwen2-audio',
  latencyMs: 185,
};

const FRIENDLY_CATEGORY_TITLE: Record<string, string> = {
  'Gas / Colic': 'Tummy Gas or Needs to Burp',
  Hunger: 'Hungry — Ready for a Feeding',
  'Sleep Regression / Overtired': 'Tired — Ready for a Nap or Sleep',
  'Discomfort / Wet Diaper': 'Uncomfortable — Check Diaper or Clothing',
  'Needs Soothing': 'Wants Cuddles & Gentle Comfort',
};

export default function HomePage() {
  const [analysis, setAnalysis] = useState<CryAnalysisResult>(INITIAL_ANALYSIS);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>(
    {}
  );
  const [careLogs, setCareLogs] = useState<CareLogItem[]>(INITIAL_LOGS);
  const [logFilter, setLogFilter] = useState<
    'all' | 'cry' | 'feed' | 'diaper' | 'medication'
  >('all');

  // Caregiver Role & Large Easy-Read Text Accessibility State
  const [caregiverRole, setCaregiverRole] = useState<CaregiverRole>('parent');
  const [largeText, setLargeText] = useState(false);
  const [showAdvancedTech, setShowAdvancedTech] = useState(false);
  const [show3DVisualizer, setShow3DVisualizer] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Theme & Brand Logo Craft State
  const [themeSetting, setThemeSetting] = useState<ThemeSetting>('nocturne');
  const [resolvedTheme, setResolvedTheme] = useState<
    'nocturne' | 'redlight' | 'lunar' | 'daylight'
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
  const [quickLogNote, setQuickLogNote] = useState('120 ml (4 oz) warm bottle feed');

  // Soothing step 60s timer & Care Log Haptic Alert Timers
  const [soothingTimerSecs, setSoothingTimerSecs] = useState<number | null>(
    null
  );
  const [hapticIntensity, setHapticIntensity] =
    useState<HapticIntensity>('standard');
  const [activeHapticToast, setActiveHapticToast] =
    useState<HapticEventPayload | null>(null);
  const [careReminderSecs, setCareReminderSecs] = useState<number | null>(null);
  const [careReminderLabel, setCareReminderLabel] =
    useState<string>('Burp & Tummy Check');

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

  // Sync Large Text Mode with root <html> attribute
  useEffect(() => {
    document.documentElement.setAttribute(
      'data-large-text',
      largeText ? 'true' : 'false'
    );
  }, [largeText]);

  // Synchronize Theme with DOM & Browser Meta Theme-Color (web.dev/learn/design/theming)
  useEffect(() => {
    const applyTheme = (mode: ThemeSetting) => {
      let actual: 'nocturne' | 'redlight' | 'lunar' | 'daylight' = 'nocturne';
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
            : actual === 'redlight'
              ? '#070102'
              : '#0c0a09';
      document.documentElement.style.backgroundColor = bgHex;
      document.body.style.backgroundColor = bgHex;

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
        message: 'Automatic cloud & on-device cry analyzer is active.',
      });
    }
  }, [ollamaBaseUrl]);

  useEffect(() => {
    checkOllamaConnection();
  }, [checkOllamaConnection]);

  const showHapticPulseBanner = useCallback((payload: HapticEventPayload) => {
    setActiveHapticToast(payload);
  }, []);

  useEffect(() => {
    if (!activeHapticToast) return;
    const t = setTimeout(() => {
      setActiveHapticToast(null);
    }, 4200);
    return () => clearTimeout(t);
  }, [activeHapticToast]);

  // 1-Minute Soothing Timer with Haptic Vibration on Expiration
  useEffect(() => {
    if (soothingTimerSecs === null) return;
    if (soothingTimerSecs <= 0) {
      setSoothingTimerSecs(null);
      triggerNurseryHaptic('timer-expired', {
        intensity: hapticIntensity,
        customLabel: '1-Minute Calming Timer Finished — Check if Baby Settled',
        onVisualPulse: showHapticPulseBanner,
      });
      const nowTime = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      saveLogs([
        {
          id: `timer-${Date.now()}`,
          type: 'sleep',
          title: '1-Min Soothing Timer Completed',
          detail: 'Haptic vibration alert triggered for caregiver check',
          timestamp: nowTime,
          minutesAgo: 0,
        },
        ...careLogs,
      ]);
      return;
    }
    const timer = setTimeout(() => {
      setSoothingTimerSecs((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    soothingTimerSecs,
    hapticIntensity,
    showHapticPulseBanner,
    saveLogs,
    careLogs,
  ]);

  // Care Log Reminder Timer (e.g., 10s Demo / 15m Burp / 30m Nap Check) with Haptic Alert
  useEffect(() => {
    if (careReminderSecs === null) return;
    if (careReminderSecs <= 0) {
      setCareReminderSecs(null);
      triggerNurseryHaptic('timer-expired', {
        intensity: hapticIntensity,
        customLabel: `Care Log Timer Expired: ${careReminderLabel}`,
        onVisualPulse: showHapticPulseBanner,
      });
      const nowTime = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      saveLogs([
        {
          id: `reminder-${Date.now()}`,
          type: 'feed',
          title: `Timer Alert: ${careReminderLabel}`,
          detail: 'Caregiver notified via tactile haptic vibration pattern',
          timestamp: nowTime,
          minutesAgo: 0,
        },
        ...careLogs,
      ]);
      return;
    }
    const timer = setTimeout(() => {
      setCareReminderSecs((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    careReminderSecs,
    careReminderLabel,
    hapticIntensity,
    showHapticPulseBanner,
    saveLogs,
    careLogs,
  ]);

  const handleClassificationResult = useCallback(
    (result: CryAnalysisResult) => {
      setAnalysis(result);
      setCompletedSteps({});

      const friendlyTitle =
        FRIENDLY_CATEGORY_TITLE[result.primaryCategory] ||
        result.primaryCategory;

      // Trigger Cry Detected Haptic Vibration Pattern for Noisy Nursery Accessibility
      triggerNurseryHaptic('cry-detected', {
        intensity: hapticIntensity,
        categoryHint: result.primaryCategory,
        customLabel: `Cry Alert: ${friendlyTitle} (${result.confidenceScore}% Match)`,
        onVisualPulse: showHapticPulseBanner,
      });

      const nowTime = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      const newEntry: CareLogItem = {
        id: `cry-${Date.now()}`,
        type: 'cry',
        title: `${friendlyTitle}`,
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
    [hapticIntensity, showHapticPulseBanner]
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
      detail: quickLogNote.trim() || 'Routine baby care check completed',
      timestamp: nowTime,
      minutesAgo: 0,
    };

    if (quickLogType === 'feed') setMinsSinceFeed(0);
    if (quickLogType === 'diaper') setMinsSinceDiaper(0);
    if (quickLogType === 'sleep') setMinsSinceSleep(0);

    triggerNurseryHaptic('care-logged', {
      intensity: hapticIntensity,
      customLabel: `${titleMap[quickLogType]} — Saved to Family Care Log`,
      onVisualPulse: showHapticPulseBanner,
    });

    saveLogs([newItem, ...careLogs]);
    setShowQuickLogModal(false);
  };

  const handleQuickResetCounter = useCallback(
    (type: 'feed' | 'diaper' | 'sleep') => {
      const labelMap = {
        feed: 'Baby Fed Just Now — Haptic Confirmed',
        diaper: 'Fresh Diaper Logged — Haptic Confirmed',
        sleep: 'Baby Fell Asleep — Haptic Confirmed',
      };
      triggerNurseryHaptic('care-logged', {
        intensity: hapticIntensity,
        customLabel: labelMap[type],
        onVisualPulse: showHapticPulseBanner,
      });
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
            title: 'Baby Fed Just Now',
            detail: 'Marked via one-tap caregiver button',
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
            title: 'Fresh Diaper Change',
            detail: 'Marked via one-tap caregiver button',
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
            title: 'Baby Fell Asleep',
            detail: 'Sleep timer started via one-tap caregiver button',
            timestamp: nowTime,
            minutesAgo: 0,
          },
          ...careLogs,
        ]);
      }
    },
    [careLogs, hapticIntensity, saveLogs, showHapticPulseBanner]
  );

  // Speak soothing steps aloud for hands-free caregivers / grandparents
  const speakResultAloud = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const friendlyHeading =
      FRIENDLY_CATEGORY_TITLE[analysis.primaryCategory] ||
      analysis.primaryCategory;
    const text = `Baby most likely needs help with ${friendlyHeading}. ${analysis.immediateSoothingAction}. ${
      analysis.soothingSteps ? analysis.soothingSteps.join('. ') : ''
    }`;
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.92;
    window.speechSynthesis.speak(utter);
  };

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

  // Native Web Share API for Caregiver Handoff Summary
  const handleShareSummary = async () => {
    const friendlyHeading =
      FRIENDLY_CATEGORY_TITLE[analysis.primaryCategory] ||
      analysis.primaryCategory;
    const summaryText = `Baby Care Update: Latest cry checked — ${friendlyHeading} (${analysis.confidenceScore}% match). What helped: ${analysis.immediateSoothingAction}. Last fed ${minsSinceFeed} mins ago, last diaper ${minsSinceDiaper} mins ago.`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Baby Care Handoff Update',
          text: summaryText,
          url: window.location.href,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    navigator.clipboard.writeText(summaryText);
    setShareFeedback('Update Copied!');
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

  // Aggregate Daily Care Log Summary (Feedings, Diaper Changes, Total Sleep Duration & Cries)
  const dailySummary = React.useMemo(() => {
    let feedCount = 0;
    let totalFeedMl = 0;
    let diaperCount = 0;
    let sleepCount = 0;
    let totalSleepMinutes = 0;
    let cryCount = 0;
    let settledCryCount = 0;
    let medicationCount = 0;

    for (const item of careLogs) {
      const combinedText = `${item.title} ${item.detail}`;
      if (item.type === 'feed') {
        feedCount += 1;
        const mlMatch = combinedText.match(/(\d+)\s*ml/i);
        if (mlMatch) {
          totalFeedMl += parseInt(mlMatch[1], 10);
        } else {
          totalFeedMl += 110;
        }
      } else if (item.type === 'diaper') {
        diaperCount += 1;
      } else if (item.type === 'sleep') {
        sleepCount += 1;
        // Parse e.g. "2h 55m", "+1.5h", or default to 45m nap
        const hmMatch = combinedText.match(/(\d+)\s*h\s*(\d+)\s*m/i);
        const decimalHourMatch = combinedText.match(/\+?(\d+(?:\.\d+)?)\s*h/i);
        const minOnlyMatch = combinedText.match(/(\d+)\s*m(?:in)?/i);

        if (hmMatch) {
          totalSleepMinutes +=
            parseInt(hmMatch[1], 10) * 60 + parseInt(hmMatch[2], 10);
        } else if (decimalHourMatch) {
          totalSleepMinutes += Math.round(
            parseFloat(decimalHourMatch[1]) * 60
          );
        } else if (minOnlyMatch) {
          totalSleepMinutes += parseInt(minOnlyMatch[1], 10);
        } else {
          totalSleepMinutes += 45;
        }
      } else if (item.type === 'cry') {
        cryCount += 1;
        if (item.resolved) settledCryCount += 1;
      } else if (item.type === 'medication') {
        medicationCount += 1;
      }
    }

    const sleepHours = Math.floor(totalSleepMinutes / 60);
    const sleepRemainderMins = totalSleepMinutes % 60;
    const formattedSleepDuration =
      totalSleepMinutes === 0
        ? '0m'
        : sleepHours > 0
          ? `${sleepHours}h ${sleepRemainderMins}m`
          : `${sleepRemainderMins}m`;

    const reportText = `Daily Care Report: ${feedCount} ${
      feedCount === 1 ? 'feeding' : 'feedings'
    } (~${totalFeedMl} ml), ${diaperCount} ${
      diaperCount === 1 ? 'diaper change' : 'diaper changes'
    }, ${formattedSleepDuration} total sleep across ${sleepCount} ${
      sleepCount === 1 ? 'stretch' : 'stretches'
    }${
      medicationCount > 0
        ? `, and ${medicationCount} medication ${
            medicationCount === 1 ? 'dose' : 'doses'
          }`
        : ''
    }${
      cryCount > 0 ? ` (${settledCryCount}/${cryCount} cries settled)` : ''
    }.`;

    return {
      feedCount,
      totalFeedMl,
      diaperCount,
      sleepCount,
      formattedSleepDuration,
      cryCount,
      settledCryCount,
      medicationCount,
      reportText,
    };
  }, [careLogs]);

  const friendlyHeadline =
    FRIENDLY_CATEGORY_TITLE[analysis.primaryCategory] ||
    analysis.primaryCategory;

  return (
    <div className="min-h-dvh bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col transition-colors">
      <OfflineIndicator />

      {/* Live Tactile Haptic Pulse Banner for Noisy Nursery Accessibility */}
      <AnimatePresence>
        {activeHapticToast && (
          <motion.div
            key={activeHapticToast.timestamp}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2 }}
            role="status"
            aria-live="polite"
            className="fixed bottom-5 right-5 z-50 max-w-sm p-4 rounded-2xl bg-[var(--bg-elevated)] border-2 border-amber-400/70 shadow-2xl flex items-center gap-3.5"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center shrink-0 animate-pulse">
              <Vibrate className="w-5 h-5 text-[var(--accent-primary)]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-[var(--accent-primary)] flex items-center gap-1.5">
                <span>Haptic Vibration Active</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-[11px]">
                  [{activeHapticToast.pattern.join('·')}ms]
                </span>
              </div>
              <p className="text-xs font-semibold text-[var(--text-primary)] mt-0.5 leading-snug">
                {activeHapticToast.label}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/90 backdrop-blur-md sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#care-guide"
          className="text-lg font-bold tracking-tight text-[var(--text-primary)] whitespace-nowrap shrink-0"
        >
          Kora Baby Care
        </a>

        {/* Zone 2: 5 clear, everyday navigation links for all caregivers */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[var(--text-secondary)]">
          <a
            href="#care-guide"
            className="hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
          >
            Care Guide
          </a>
          <a
            href="#decoder"
            className="hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
          >
            Cry Translator
          </a>
          <a
            href="#soundscape"
            className="hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
          >
            Calming Sounds
          </a>
          <a
            href="#care-log"
            className="hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
          >
            Care Log
          </a>
          <a
            href="#sleep-trends"
            className="hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
          >
            Sleep Chart
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setShowQuickLogModal(true)}
            className="min-h-[42px] px-4 py-2 text-xs font-bold text-stone-950 bg-[var(--accent-primary)] hover:opacity-95 rounded-xl transition-opacity whitespace-nowrap shrink-0"
          >
            + Log Feed / Diaper
          </button>
        </div>
      </header>

      {/* Main 1440px Multi-Column Workspace */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-7">
        {/* Top Section: Welcoming Brand Header + Caregiver Handoff Card + Quick One-Tap Routine Strip */}
        <section id="care-guide" className="flex flex-col gap-5">
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
                title="Tap to switch icon style"
              >
                <KoraLogo variant={logoVariant} size={56} />
              </button>

              <div>
                <div className="text-xs text-[var(--text-secondary)] mb-1">
                  <span>Easy for Parents, Grandparents & Babysitters</span>
                  <span aria-hidden="true" className="mx-2">
                    ·
                  </span>
                  <span className="text-[var(--accent-primary)] font-semibold">
                    {offlinePackReady
                      ? 'Works Offline'
                      : 'Private & Instant'}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
                  Baby Cry Translator & Simple Care Helper
                </h1>
              </div>
            </div>

            {/* Easy Lighting Mode + Screen Awake + Share Update */}
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
                role="group"
                aria-label="Lighting mode"
              >
                {(
                  [
                    { id: 'redlight', label: 'Red Light', icon: Eye },
                    { id: 'nocturne', label: 'Night Glow', icon: Moon },
                    { id: 'lunar', label: 'Soft Blue', icon: Sparkles },
                    { id: 'daylight', label: 'Bright Day', icon: Sun },
                  ] as const
                ).map((t) => {
                  const Icon = t.icon;
                  const active = themeSetting === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setThemeSetting(t.id);
                        if (t.id === 'redlight') {
                          triggerNurseryHaptic('step-checked', {
                            intensity: hapticIntensity,
                            customLabel:
                              'High-Contrast Red Light Mode On — Baby Sleep Protected',
                            onVisualPulse: showHapticPulseBanner,
                          });
                        }
                      }}
                      className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-[var(--accent-primary)] text-stone-950 font-bold'
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
                className={`min-h-[40px] px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  wakeLockActive
                    ? 'bg-amber-400/15 border-amber-400/40 text-[var(--accent-primary)]'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title="Keep phone screen from turning off while caring for baby"
              >
                <Smartphone className="w-4 h-4" />
                <span>{wakeLockActive ? 'Screen Stays On' : 'Keep Screen On'}</span>
              </button>

              <button
                type="button"
                onClick={handleShareSummary}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Share2 className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>{shareFeedback || 'Send Update to Family'}</span>
              </button>

              <PWAInstallButton />
            </div>
          </div>

          {resolvedTheme === 'redlight' && (
            <div className="p-3.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs font-semibold text-[var(--text-primary)]">
                <Eye className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                <span>
                  <strong>640nm High-Contrast Red Light Mode Active:</strong>{' '}
                  Zero blue or green light emission — protects baby&apos;s sleep
                  cycles and preserves your dark-room night vision.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setThemeSetting('nocturne')}
                className="min-h-[32px] px-3 py-1 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] whitespace-nowrap"
              >
                Switch to Standard Night Glow
              </button>
            </div>
          )}

          {/* Family & Babysitter At-a-Glance Handoff Card + Large Text Switch */}
          <CaregiverHandoffCard
            role={caregiverRole}
            onRoleChange={(nextRole) => {
              setCaregiverRole(nextRole);
              if (nextRole === 'grandparent') {
                setShow3DVisualizer(false);
              } else {
                setShow3DVisualizer(true);
              }
            }}
            largeText={largeText}
            onToggleLargeText={() => setLargeText((prev) => !prev)}
            minsSinceFeed={minsSinceFeed}
            minsSinceSleep={minsSinceSleep}
            minsSinceDiaper={minsSinceDiaper}
          />

          {/* 4 Big One-Tap Baby Status Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-[var(--text-secondary)]">
                  Last Fed
                </div>
                <div className="text-lg font-bold font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
                  {formatMins(minsSinceFeed)}
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {minsSinceFeed > 150
                    ? 'Likely getting hungry soon'
                    : 'Comfortable & recently fed'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleQuickResetCounter('feed')}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--accent-primary)] transition-colors whitespace-nowrap shrink-0"
              >
                Fed Just Now
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-[var(--text-secondary)]">
                  Awake Time
                </div>
                <div className="text-lg font-bold font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
                  {formatMins(minsSinceSleep)}
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {minsSinceSleep > 75
                    ? 'Ready for a nap soon'
                    : 'Happy & rested'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleQuickResetCounter('sleep')}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--accent-primary)] transition-colors whitespace-nowrap shrink-0"
              >
                Fell Asleep
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-[var(--text-secondary)]">
                  Last Diaper Change
                </div>
                <div className="text-lg font-bold font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
                  {formatMins(minsSinceDiaper)}
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {minsSinceDiaper > 150
                    ? 'Time to check diaper'
                    : 'Clean & dry'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleQuickResetCounter('diaper')}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--accent-primary)] transition-colors whitespace-nowrap shrink-0"
              >
                Just Changed
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-[var(--text-secondary)]">
                  Latest Cry Result
                </div>
                <div className="text-base font-bold text-[var(--text-primary)] mt-0.5 truncate max-w-[150px]">
                  {analysis.primaryCategory}
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Match confidence:{' '}
                  <span className="font-mono tabular-nums font-bold text-[var(--text-primary)]">
                    {analysis.confidenceScore}%
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={speakResultAloud}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                title="Read soothing steps out loud"
              >
                <Volume2 className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Read Aloud</span>
              </button>
            </div>
          </div>
        </section>

        {/* Primary 12-Column Split: Left (Cry Recorder + Clear Soothing Guide + Optional 3D) | Right (Calming Sounds + Voice + Care Log) */}
        <div
          id="decoder"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        >
          {/* Left 7 Columns */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Step 1: 5-Second Audio Recorder (Placed first so nobody has to scroll past 3D graphics to use the mic!) */}
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

            {/* Step 2: Plain-English "What Baby Likely Needs & How to Calm" Card */}
            <motion.div
              key={analysis.primaryCategory + analysis.confidenceScore}
              initial={hasMounted ? { opacity: 0.85, y: 6 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="p-6 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col gap-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[var(--border-subtle)]">
                <div>
                  <div className="text-xs font-semibold text-[var(--accent-primary)]">
                    Step 2: What Baby Likely Needs Right Now
                  </div>
                  <h2 className="text-2xl font-bold text-[var(--text-primary)] mt-1">
                    {friendlyHeadline}
                  </h2>
                  {analysis.acousticSignature && (
                    <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                      {analysis.acousticSignature}
                    </p>
                  )}
                </div>

                <div className="flex items-center sm:flex-col sm:items-end justify-between gap-2 shrink-0">
                  <span className="text-xs text-[var(--text-secondary)]">
                    Likelihood Match
                  </span>
                  <span className="text-3xl font-bold font-mono tabular-nums text-[var(--accent-primary)]">
                    {analysis.confidenceScore}%
                  </span>
                </div>
              </div>

              {/* Immediate Soothing Action & Interactive 60s Action Checklist (Moved ABOVE probabilities for instant actionability) */}
              <div className="p-5 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-[var(--accent-primary)]">
                      What to Do First
                    </div>
                    <p className="text-base font-bold text-[var(--text-primary)] mt-1 leading-snug">
                      {analysis.immediateSoothingAction}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={speakResultAloud}
                      className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <Volume2 className="w-4 h-4 text-[var(--accent-primary)]" />
                      <span>Read Steps Aloud</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setSoothingTimerSecs((prev) =>
                          prev === null ? 60 : null
                        )
                      }
                      className="min-h-[42px] px-3.5 py-2 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 text-xs font-bold text-[var(--accent-primary)] flex items-center gap-2 transition-colors whitespace-nowrap"
                    >
                      <Clock className="w-4 h-4" />
                      <span className="font-mono tabular-nums">
                        {soothingTimerSecs !== null
                          ? `Timer: ${soothingTimerSecs}s`
                          : '1-Min Timer'}
                      </span>
                    </button>
                  </div>
                </div>

                {analysis.soothingSteps && analysis.soothingSteps.length > 0 && (
                  <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-col gap-2.5">
                    <div className="text-xs font-medium text-[var(--text-secondary)]">
                      Easy Step-by-Step Checklist (Tap each step as you try it):
                    </div>
                    {analysis.soothingSteps.map((step, idx) => {
                      const done = Boolean(completedSteps[idx]);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            triggerNurseryHaptic('step-checked', {
                              intensity: hapticIntensity,
                            });
                            setCompletedSteps((prev) => ({
                              ...prev,
                              [idx]: !prev[idx],
                            }));
                          }}
                          className={`min-h-[48px] px-4 py-3 rounded-xl border text-left text-xs sm:text-sm flex items-center gap-3 transition-colors ${
                            done
                              ? 'bg-emerald-950/30 border-emerald-500/30 text-[var(--text-secondary)] line-through'
                              : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                          }`}
                        >
                          <CheckCircle2
                            className={`w-5 h-5 shrink-0 ${
                              done
                                ? 'text-emerald-400'
                                : 'text-[var(--accent-primary)]'
                            }`}
                          />
                          <span>
                            <strong>Step {idx + 1}:</strong> {step}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 4-Axis Plain-English Possibility Breakdown */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span>Other Possible Reasons for This Cry</span>
                  <span className="font-mono tabular-nums">Likelihood (%)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(
                    [
                      {
                        key: 'gas',
                        label: 'Tummy Gas / Needs to Burp',
                        val: analysis.probabilityBreakdown.gas,
                      },
                      {
                        key: 'hunger',
                        label: 'Hungry / Ready for Milk',
                        val: analysis.probabilityBreakdown.hunger,
                      },
                      {
                        key: 'overtired',
                        label: 'Tired / Ready for Sleep',
                        val: analysis.probabilityBreakdown.overtired,
                      },
                      {
                        key: 'discomfort',
                        label: 'Wet Diaper / Too Warm or Cool',
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
                                ? 'font-bold text-[var(--accent-primary)]'
                                : 'text-[var(--text-primary)]'
                            }
                          >
                            {item.label}
                          </span>
                          <span className="font-mono tabular-nums font-bold text-[var(--text-primary)]">
                            {item.val}%
                          </span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-stone-800/60 overflow-hidden">
                          <motion.div
                            initial={hasMounted ? { width: 0 } : false}
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
            </motion.div>

            {/* Interactive 3D Sound Orb (Can be hidden in Grandparent View for maximum simplicity) */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  3D Interactive Cry Sound Visualizer
                </span>
                <button
                  type="button"
                  onClick={() => setShow3DVisualizer((prev) => !prev)}
                  className="text-xs font-semibold text-[var(--accent-primary)] hover:underline"
                >
                  {show3DVisualizer ? 'Hide 3D Orb' : 'Show 3D Orb'}
                </button>
              </div>

              {show3DVisualizer && (
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
              )}
            </div>
          </div>

          {/* Right 5 Columns: Calming Soundscape Player + Hands-Free Voice + Shared Family Care Log */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Step 3: Calming White Noise & Heartbeat Sounds */}
            <div id="soundscape">
              <SoundscapePlayer
                onTimerExpired={() => {
                  triggerNurseryHaptic('timer-expired', {
                    intensity: hapticIntensity,
                    customLabel:
                      'Calming Soundscape Sleep Timer Finished — Haptic Alert',
                    onVisualPulse: showHapticPulseBanner,
                  });
                }}
              />
            </div>

            {/* Hands-Free Voice Reader & Voice Commands */}
            <VoiceControlBar
              analysis={analysis}
              onTriggerPresetCry={(preset) =>
                setExternalPresetTrigger({ preset, ts: Date.now() })
              }
              onQuickLog={handleQuickResetCounter}
            />

            {/* Shared Family & Babysitter Care Log with Tactile Haptic Alert System */}
            <div
              id="care-log"
              className="p-6 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col gap-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    Shared Family & Babysitter Log
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Includes vibration alerts for noisy rooms when cries or timers trigger
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowQuickLogModal(true)}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span>Add Note</span>
                </button>
              </div>

              {/* Tactile Haptic Feedback & Care Timer Alert System */}
              <div className="p-4 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Vibrate className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      Noisy Nursery Vibration Alerts
                    </span>
                  </div>

                  {/* Haptic Intensity Selector */}
                  <div
                    className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
                    role="group"
                    aria-label="Vibration alert strength"
                  >
                    {(
                      [
                        { id: 'off', label: 'Off' },
                        { id: 'gentle', label: 'Gentle' },
                        { id: 'standard', label: 'Standard' },
                        { id: 'strong', label: 'Strong' },
                      ] as const
                    ).map((lvl) => (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => {
                          setHapticIntensity(lvl.id);
                          if (lvl.id !== 'off') {
                            triggerNurseryHaptic('step-checked', {
                              intensity: lvl.id,
                              customLabel: `Vibration strength set to ${lvl.label}`,
                              onVisualPulse: showHapticPulseBanner,
                            });
                          }
                        }}
                        className={`min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                          hapticIntensity === lvl.id
                            ? 'bg-[var(--accent-primary)] text-stone-950'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {lvl.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Care Timer & Haptic Test Row */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (careReminderSecs !== null) {
                        setCareReminderSecs(null);
                      } else {
                        setCareReminderLabel('10s Quick Haptic Demo');
                        setCareReminderSecs(10);
                      }
                    }}
                    className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      careReminderSecs !== null
                        ? 'bg-amber-400/20 border-amber-400/50 text-[var(--accent-primary)]'
                        : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                    }`}
                  >
                    <BellRing className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span className="font-mono tabular-nums">
                      {careReminderSecs !== null
                        ? `Alert in ${careReminderSecs}s (Cancel)`
                        : 'Start 10s Alert Timer'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCareReminderLabel('15-Min Burp & Tummy Check');
                      setCareReminderSecs(15 * 60);
                    }}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] transition-colors"
                  >
                    15m Burp Timer
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      triggerNurseryHaptic('cry-detected', {
                        intensity:
                          hapticIntensity === 'off' ? 'standard' : hapticIntensity,
                        categoryHint: analysis.primaryCategory,
                        customLabel: `Test Cry Alert: ${friendlyHeadline}`,
                        onVisualPulse: showHapticPulseBanner,
                      })
                    }
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--accent-primary)] flex items-center gap-1.5 transition-colors ml-auto"
                  >
                    <Vibrate className="w-3.5 h-3.5" />
                    <span>Test Vibration</span>
                  </button>
                </div>
              </div>

              {/* Interactive Segmented Filter Controls */}
              <div className="flex items-center gap-1 p-1 bg-[var(--bg-canvas)] rounded-xl border border-[var(--border-subtle)] overflow-x-auto">
                {(
                  [
                    { id: 'all', label: 'All Events' },
                    { id: 'cry', label: 'Cries' },
                    { id: 'feed', label: 'Feedings' },
                    { id: 'diaper', label: 'Diapers' },
                    { id: 'medication', label: 'Meds' },
                  ] as const
                ).map((tab) => {
                  const active = logFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setLogFilter(tab.id)}
                      className={`relative flex-1 min-h-[38px] px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                        active
                          ? 'text-[var(--text-primary)]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId={hasMounted ? 'careLogActiveFilter' : undefined}
                          transition={{
                            type: 'spring',
                            stiffness: 420,
                            damping: 32,
                          }}
                          className="absolute inset-0 rounded-lg bg-[var(--bg-elevated)] shadow-sm"
                        />
                      )}
                      <span className="relative z-10">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Log Items List with Framer Motion Entry & Exit Animations */}
              <div className="flex flex-col divide-y divide-[var(--border-subtle)] overflow-hidden">
                <AnimatePresence initial={false}>
                  {filteredLogs.length === 0 ? (
                    <motion.div
                      key="empty-care-logs"
                      initial={hasMounted ? { opacity: 0, y: 8 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.18 }}
                      className="py-8 text-center text-xs text-[var(--text-secondary)]"
                    >
                      No events logged in this category yet.
                    </motion.div>
                  ) : (
                    filteredLogs.slice(0, 7).map((item) => (
                      <motion.div
                        layout={hasMounted}
                        key={item.id}
                        initial={
                          hasMounted
                            ? { opacity: 0, y: -12, scale: 0.97 }
                            : false
                        }
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -24, scale: 0.95 }}
                        transition={{
                          duration: 0.22,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        className="py-3.5 first:pt-1 last:pb-1 flex items-start justify-between gap-3"
                      >
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-bold text-[var(--text-primary)] truncate">
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
                          </div>
                          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                            {item.detail}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              triggerNurseryHaptic(
                                item.type === 'cry'
                                  ? 'cry-detected'
                                  : item.type === 'medication'
                                    ? 'medication-due'
                                    : 'care-logged',
                                {
                                  intensity:
                                    hapticIntensity === 'off'
                                      ? 'standard'
                                      : hapticIntensity,
                                  categoryHint: item.title,
                                  customLabel: `Replaying Haptic Alert: ${item.title}`,
                                  onVisualPulse: showHapticPulseBanner,
                                }
                              )
                            }
                            title="Feel haptic vibration pattern for this log alert"
                            aria-label="Replay haptic alert vibration"
                            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-canvas)] transition-colors"
                          >
                            <Vibrate className="w-4 h-4" />
                          </button>
                          {item.type === 'cry' && (
                            <button
                              type="button"
                              onClick={() => {
                                triggerNurseryHaptic('care-logged', {
                                  intensity: hapticIntensity,
                                  customLabel:
                                    'Baby Marked Calm — Haptic Confirmed',
                                  onVisualPulse: showHapticPulseBanner,
                                });
                                toggleLogResolved(item.id);
                              }}
                              className={`min-h-[38px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                                item.resolved
                                  ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                              }`}
                            >
                              {item.resolved ? 'Baby Calm ✓' : 'Mark Calm'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteLogItem(item.id)}
                            aria-label="Delete log entry"
                            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-rose-400 hover:bg-[var(--bg-canvas)] transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>

              {/* Concise Daily Care Summary Report at Bottom of Care Log */}
              <div className="mt-2 pt-4 border-t border-[var(--border-subtle)] flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
                      Daily Care Summary Report
                    </h4>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Live totals from today&apos;s logged feedings, diapers &amp; sleep
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      copyCommand(dailySummary.reportText, 'daily-report');
                      triggerNurseryHaptic('step-checked', {
                        intensity: hapticIntensity,
                        customLabel: 'Daily Care Summary Copied to Clipboard',
                        onVisualPulse: showHapticPulseBanner,
                      });
                    }}
                    className="min-h-[34px] px-3 py-1.5 rounded-xl bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  >
                    {copiedCmd === 'daily-report' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Report Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                        <span>Copy Daily Report</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 3-Column Aggregated KPI Tiles: Feedings | Diaper Changes | Total Sleep Duration */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] flex flex-col">
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      Feedings
                    </span>
                    <span className="text-lg font-bold font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
                      {dailySummary.feedCount}
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-[var(--accent-primary)]">
                      ~{dailySummary.totalFeedMl} ml total
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] flex flex-col">
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      Diaper Changes
                    </span>
                    <span className="text-lg font-bold font-mono tabular-nums text-[var(--text-primary)] mt-0.5">
                      {dailySummary.diaperCount}
                    </span>
                    <span className="text-[11px] text-emerald-400">
                      {dailySummary.diaperCount > 0
                        ? 'Logged & checked'
                        : 'None logged yet'}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] flex flex-col">
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      Total Sleep
                    </span>
                    <span className="text-lg font-bold font-mono tabular-nums text-sky-400 mt-0.5">
                      {dailySummary.formattedSleepDuration}
                    </span>
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      {dailySummary.sleepCount}{' '}
                      {dailySummary.sleepCount === 1 ? 'stretch' : 'stretches'}
                    </span>
                  </div>
                </div>

                {/* Plain-English Concise Daily Report Line */}
                <div className="px-3.5 py-2.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] leading-relaxed">
                  {dailySummary.reportText}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Specialized Medication & Supplement Log with Recurring Haptic Reminders */}
        <MedicationLogCard
          caregiverRole={caregiverRole}
          hapticIntensity={hapticIntensity}
          onVisualPulse={showHapticPulseBanner}
          onLogMedicationDose={({
            medicationName,
            dosage,
            frequencyHours,
            administeredBy,
            instructions,
            timestamp,
          }) => {
            saveLogs([
              {
                id: `med-log-${Date.now()}`,
                type: 'medication',
                title: `${medicationName} (${dosage})`,
                detail: `Every ${frequencyHours}h schedule · Given by ${administeredBy} · ${instructions}`,
                timestamp,
                minutesAgo: 0,
              },
              ...careLogs,
            ]);
          }}
        />

        {/* Sleep Trend Analytics & Smart Pediatric Recommendations */}
        <SleepTrendsAndRecs
          analysis={analysis}
          minsSinceFeed={minsSinceFeed}
          minsSinceSleep={minsSinceSleep}
          minsSinceDiaper={minsSinceDiaper}
          onLogSleepBlock={(hours, kind) => {
            setMinsSinceSleep(0);
            const nowTime = new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            saveLogs([
              {
                id: `sleep-block-${Date.now()}`,
                type: 'sleep',
                title:
                  kind === 'night'
                    ? `Night Sleep Stretch (+${hours}h)`
                    : `Daytime Nap (+${hours}h)`,
                detail: 'Logged from Sleep Schedule & Trend Chart',
                timestamp: nowTime,
                minutesAgo: 0,
              },
              ...careLogs,
            ]);
          }}
          onStartWindDownTimer={() => setSoothingTimerSecs(60)}
        />

        {/* Collapsible Technical & Offline AI Settings Drawer (Keeps UI clean for Grandparents & Babysitters) */}
        <section
          id="offline-llm"
          className="rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden"
        >
          <button
            type="button"
            onClick={() => setShowAdvancedTech((prev) => !prev)}
            className="w-full p-5 sm:p-6 flex items-center justify-between gap-4 text-left hover:bg-[var(--bg-elevated)]/40 transition-colors"
          >
            <span className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                <Sliders className="w-5 h-5 text-[var(--accent-primary)]" />
              </span>
              <span className="block">
                <span className="text-base font-bold text-[var(--text-primary)] block">
                  Offline Mode & Advanced AI Settings (Optional)
                </span>
                <span className="text-xs text-[var(--text-secondary)] mt-0.5 block">
                  Download offline cry packs for travel or connect a home computer running Ollama
                </span>
              </span>
            </span>
            <span className="flex items-center gap-2 text-xs font-semibold text-[var(--accent-primary)] shrink-0">
              <span>{showAdvancedTech ? 'Hide Settings' : 'Show Settings'}</span>
              {showAdvancedTech ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </span>
          </button>

          {showAdvancedTech && (
            <div className="p-6 pt-0 border-t border-[var(--border-subtle)] flex flex-col gap-6 mt-4">
              <OfflineModelManager
                onOfflineModelStatusChange={setOfflinePackReady}
              />

              {/* Local Ollama & Vercel AI SDK Configuration Section */}
              <div
                id="ollama-setup"
                className="p-6 rounded-3xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] flex flex-col gap-6"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[var(--border-subtle)]">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] mb-1">
                      <span>Local Home Server Connection</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-[var(--text-primary)]">
                        {ollamaStatus.online
                          ? 'Ollama Connected'
                          : 'Automatic Built-In Analyzer Active'}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-[var(--text-primary)]">
                      Ollama & Vercel AI SDK Local Audio Pipeline
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={checkOllamaConnection}
                    disabled={ollamaStatus.checking}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 text-[var(--accent-primary)] ${
                        ollamaStatus.checking ? 'animate-spin' : ''
                      }`}
                    />
                    <span>Check Local Connection</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-6 flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-[var(--text-primary)]">
                        Analyzer Mode
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            { id: 'auto', label: 'Automatic (Recommended)' },
                            { id: 'ollama', label: 'Local Ollama Only' },
                            { id: 'gemini', label: 'Cloud AI' },
                          ] as const
                        ).map((mode) => (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => setInferenceMode(mode.id)}
                            className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap truncate ${
                              inferenceMode === mode.id
                                ? 'bg-amber-400/15 border-amber-400/40 text-[var(--text-primary)]'
                                : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
                          Ollama URL
                        </label>
                        <input
                          id="ollama-url"
                          type="text"
                          value={ollamaBaseUrl}
                          onChange={(e) => setOllamaBaseUrl(e.target.value)}
                          className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-primary)]"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="ollama-model"
                          className="text-xs font-medium text-[var(--text-primary)]"
                        >
                          Audio Model Name
                        </label>
                        <input
                          id="ollama-model"
                          type="text"
                          value={ollamaModel}
                          onChange={(e) => setOllamaModel(e.target.value)}
                          className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-primary)]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-6 flex flex-col gap-3">
                    <div className="text-xs font-medium text-[var(--text-primary)]">
                      Optional Home Computer Setup Commands
                    </div>

                    {[
                      {
                        id: 'cmd-pull',
                        label: '01. Download local audio model',
                        cmd: 'ollama pull qwen2-audio',
                      },
                      {
                        id: 'cmd-serve',
                        label: '02. Keep model ready in memory for 24 hours',
                        cmd: 'OLLAMA_KEEP_ALIVE=24h ollama serve',
                      },
                    ].map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col gap-2"
                      >
                        <span className="text-xs text-[var(--text-secondary)]">
                          {item.label}
                        </span>
                        <div className="flex items-center justify-between gap-2 bg-[var(--bg-elevated)] px-3.5 py-2 rounded-xl border border-[var(--border-subtle)]">
                          <code className="text-xs font-mono text-[var(--accent-primary)] truncate">
                            {item.cmd}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyCommand(item.cmd, item.id)}
                            className="min-h-[32px] px-2.5 py-1 rounded-lg bg-[var(--bg-canvas)] text-xs text-[var(--text-primary)] flex items-center gap-1.5 shrink-0"
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
              </div>
            </div>
          )}
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
                  Log Feeding, Diaper, or Nap
                </h3>
                <button
                  type="button"
                  onClick={() => setShowQuickLogModal(false)}
                  className="min-h-[38px] px-3 py-1 rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
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
                        defaultNote: '120 ml (4 oz) warm bottle feed',
                      },
                      {
                        id: 'diaper',
                        label: 'Diaper',
                        defaultNote: 'Wet diaper changed · Diaper cream',
                      },
                      {
                        id: 'sleep',
                        label: 'Sleep / Nap',
                        defaultNote: 'Asleep in crib · White noise on',
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
                      className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
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
                    Quick Note (Optional)
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
                  className="min-h-[46px] w-full py-2.5 rounded-xl bg-[var(--accent-primary)] hover:opacity-95 text-stone-950 text-xs font-bold transition-opacity"
                >
                  Save to Family Care Log
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quiet Footer */}
      <footer className="mt-auto border-t border-[var(--border-subtle)] py-6 px-6 text-center text-xs text-[var(--text-secondary)]">
        <span>Kora Baby Care</span>
        <span aria-hidden="true" className="mx-2">
          ·
        </span>
        <span>Designed for Parents, Grandparents & Babysitters</span>
        <span aria-hidden="true" className="mx-2">
          ·
        </span>
        <a
          href="/llm.txt"
          className="hover:text-[var(--text-primary)] underline underline-offset-4"
        >
          AI Info (llm.txt)
        </a>
      </footer>
    </div>
  );
}
