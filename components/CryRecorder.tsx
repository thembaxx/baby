'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Microphone as Mic,
  SpinnerGap as Loader2,
  Play,
  Square,
  UploadSimple as Upload,
  SpeakerHigh as Volume2,
  SpeakerSlash as VolumeX,
} from '@phosphor-icons/react';
import { motion } from 'motion/react';
import type { CryAnalysisResult } from '@/app/api/classify-cry/route';

export type CryPresetId = 'hunger' | 'gas' | 'overtired' | 'discomfort';

interface CryRecorderProps {
  onClassificationResult: (res: CryAnalysisResult, audioUrl?: string) => void;
  onRecordingStateChange?: (
    recording: boolean,
    analyzing: boolean,
    energy: number
  ) => void;
  externalPresetTrigger?: { preset: CryPresetId; ts: number } | null;
  careContext?: {
    minutesSinceLastFeed?: number;
    minutesSinceLastSleep?: number;
    minutesSinceLastDiaper?: number;
  };
  ollamaConfig?: {
    baseUrl: string;
    model: string;
    inferenceMode: 'auto' | 'ollama' | 'gemini';
  };
}

export function createSynthesizedCryWavBlob(preset: CryPresetId): Blob {
  const sampleRate = 16000;
  const durationSeconds = 5;
  const numSamples = sampleRate * durationSeconds;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  const baseFreq =
    preset === 'hunger'
      ? 420
      : preset === 'gas'
        ? 610
        : preset === 'overtired'
          ? 340
          : 480;
  const pulseRate =
    preset === 'hunger'
      ? 1.6
      : preset === 'gas'
        ? 2.8
        : preset === 'overtired'
          ? 0.7
          : 2.2;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.max(0, Math.sin(Math.PI * t * pulseRate));
    const vibrato = Math.sin(2 * Math.PI * 6 * t) * 18;
    const pitchDrift =
      preset === 'overtired'
        ? -35 * (t % 1.4)
        : preset === 'gas'
          ? 45 * envelope
          : 0;
    const freq = baseFreq + vibrato + pitchDrift;

    const fundamental = Math.sin(2 * Math.PI * freq * t);
    const harmonic2 = 0.45 * Math.sin(2 * Math.PI * freq * 2 * t);
    const harmonic3 = 0.25 * Math.sin(2 * Math.PI * freq * 3 * t);
    const sample = (fundamental + harmonic2 + harmonic3) * envelope * 0.35;

    const pcmValue = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * 2, pcmValue * 32767, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export function CryRecorder({
  onClassificationResult,
  onRecordingStateChange,
  externalPresetTrigger,
  careContext,
  ollamaConfig,
}: CryRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(5.0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [spectrumBars, setSpectrumBars] = useState<number[]>(() =>
    Array.from({ length: 24 }, () => 12)
  );
  const [lastAudioUrl, setLastAudioUrl] = useState<string | null>(null);
  const [isPlayingSample, setIsPlayingSample] = useState(false);
  const [mutePreview, setMutePreview] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (countdownIntervalRef.current)
        clearInterval(countdownIntervalRef.current);
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    };
  }, []);

  const stopAllTimers = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (countdownIntervalRef.current)
      clearInterval(countdownIntervalRef.current);
    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    setSpectrumBars(Array.from({ length: 24 }, () => 12));
  };

  const analyzeAudioClip = useCallback(
    async (
      blob: Blob,
      mimeType = 'audio/webm',
      presetHint?: string,
      audioUrl?: string
    ) => {
      setAnalyzing(true);
      onRecordingStateChange?.(false, true, 0.45);
      setErrorMessage(null);
      try {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const base64Audio = (reader.result as string).split(',')[1];

            const response = await fetch('/api/classify-cry', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audioBase64: base64Audio,
                mimeType,
                presetHint,
                careContext,
                ollamaBaseUrl: ollamaConfig?.baseUrl,
                ollamaModel: ollamaConfig?.model,
                inferenceMode: ollamaConfig?.inferenceMode,
              }),
            });

            const result = await response.json();
            if (!response.ok || !result?.primaryCategory) {
              throw new Error(typeof result?.error === 'string' ? result.error : 'Audio analysis unavailable');
            }
            onClassificationResult(result as CryAnalysisResult, audioUrl);
          } catch (innerErr) {
            console.error('Cry analysis request failed:', innerErr);
            setErrorMessage(
              innerErr instanceof Error ? innerErr.message : 'Could not analyze the sound right now. Please try again.'
            );
          } finally {
            setAnalyzing(false);
            onRecordingStateChange?.(false, false, 0.15);
          }
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        console.error('Cry analysis error:', err);
        setAnalyzing(false);
        onRecordingStateChange?.(false, false, 0.15);
      }
    },
    [careContext, ollamaConfig, onClassificationResult, onRecordingStateChange]
  );

  const handleRunReferenceCry = useCallback(
    async (preset: CryPresetId) => {
      if (isRecording || analyzing) return;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(15);
      }
      setActivePreset(preset);
      const wavBlob = createSynthesizedCryWavBlob(preset);
      const url = URL.createObjectURL(wavBlob);
      setLastAudioUrl(url);

      setSpectrumBars(
        Array.from({ length: 24 }, (_, idx) =>
          Math.min(95, 25 + ((idx * 19) % 65))
        )
      );

      if (!mutePreview) {
        try {
          const audio = new Audio(url);
          audio.volume = 0.25;
          audioPreviewRef.current = audio;
          audio.play().catch(() => {});
          setTimeout(() => {
            audio.pause();
          }, 1400);
        } catch {
          // Ignore audio playback errors
        }
      }

      await analyzeAudioClip(wavBlob, 'audio/wav', preset, url);
      setSpectrumBars(Array.from({ length: 24 }, () => 12));
    },
    [analyzeAudioClip, analyzing, isRecording, mutePreview]
  );

  const runExternalPresetRef = useRef(handleRunReferenceCry);
  useEffect(() => {
    runExternalPresetRef.current = handleRunReferenceCry;
  }, [handleRunReferenceCry]);

  useEffect(() => {
    if (!externalPresetTrigger) return;
    // Queue the command once; changing recorder state must not replay it.
    const command = setTimeout(() => {
      void runExternalPresetRef.current(externalPresetTrigger.preset);
    }, 0);
    return () => clearTimeout(command);
  }, [externalPresetTrigger]);

  const startRecording = async () => {
    setErrorMessage(null);
    setActivePreset(null);
    audioChunksRef.current = [];
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([20, 40, 20]);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else {
          mimeType = '';
        }
      }

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateSpectrum = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        const bars = Array.from({ length: 24 }, (_, idx) => {
          const val = dataArray[idx % dataArray.length] || 0;
          sum += val;
          return Math.max(10, Math.min(100, Math.round((val / 255) * 100)));
        });
        setSpectrumBars(bars);
        const avgEnergy = sum / (24 * 255);
        onRecordingStateChange?.(true, false, avgEnergy);
        animFrameRef.current = requestAnimationFrame(updateSpectrum);
      };
      animFrameRef.current = requestAnimationFrame(updateSpectrum);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        stopAllTimers();
        stream.getTracks().forEach((t) => t.stop());
        audioCtx.close().catch(() => {});

        const finalMime = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: finalMime });
        const objectUrl = URL.createObjectURL(audioBlob);
        setLastAudioUrl(objectUrl);
        await analyzeAudioClip(audioBlob, finalMime, undefined, objectUrl);
      };

      mediaRecorder.start();
      setIsRecording(true);
      onRecordingStateChange?.(true, false, 0.35);
      setSecondsLeft(5.0);

      const startedAt = Date.now();
      countdownIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startedAt) / 1000;
        const remaining = Math.max(0, 5.0 - elapsed);
        setSecondsLeft(Number(remaining.toFixed(1)));
      }, 100);

      stopTimeoutRef.current = setTimeout(() => {
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state === 'recording'
        ) {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
        }
      }, 5000);
    } catch (err) {
      console.error('Microphone access error:', err);
      setErrorMessage(
        'Microphone is turned off or unavailable. You can tap any of the 4 Sample Baby Cries below to see how Kora translates a cry into soothing steps.'
      );
    }
  };

  const stopRecordingEarly = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'recording'
    ) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setLastAudioUrl(url);
    await analyzeAudioClip(file, file.type || 'audio/wav', undefined, url);
    e.target.value = '';
  };

  const toggleReplaySample = () => {
    if (!lastAudioUrl) return;
    if (isPlayingSample && audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      setIsPlayingSample(false);
      return;
    }
    const audio = new Audio(lastAudioUrl);
    audioPreviewRef.current = audio;
    setIsPlayingSample(true);
    audio.onended = () => setIsPlayingSample(false);
    audio.play().catch(() => setIsPlayingSample(false));
  };

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-5 p-6 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
    >
      {/* Friendly Header & Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            Listen to baby’s cry
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            A 5-second sound check to help you understand.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMutePreview((prev) => !prev)}
            className="min-h-[42px] px-3 py-1.5 rounded-xl bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            title="Mute or unmute sample cry sound"
          >
            {mutePreview ? (
              <VolumeX className="w-4 h-4 text-[var(--text-secondary)]" />
            ) : (
              <Volume2 className="w-4 h-4 text-[var(--accent-primary)]" />
            )}
            <span>
              {mutePreview ? 'Quiet Mode (Muted)' : 'Sample Sound On'}
            </span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isRecording || analyzing}
            className="min-h-[42px] px-3 py-1.5 rounded-xl bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] flex items-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Upload className="w-4 h-4 text-[var(--text-secondary)]" />
            <span>Upload Recording</span>
          </button>
        </div>
      </div>

      {/* Main Big Easy-Tap Microphone Button */}
      <div className="flex flex-col items-center justify-center py-4 gap-4">
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={isRecording ? stopRecordingEarly : startRecording}
          disabled={analyzing}
          aria-label={isRecording ? 'Stop listening' : 'Tap to Listen to Baby'}
          className={`relative flex items-center justify-center w-28 h-28 rounded-full transition-colors shadow-xl ${
            isRecording
              ? 'bg-rose-500 text-white ring-8 ring-rose-500/25'
              : analyzing
                ? 'bg-[var(--bg-elevated)] text-[var(--accent-primary)] border border-amber-400/30'
                : 'bg-[var(--accent-primary)] hover:opacity-95 text-stone-950'
          }`}
        >
          {analyzing ? (
            <Loader2 className="w-10 h-10 animate-spin" />
          ) : isRecording ? (
            <Square weight="fill" className="w-9 h-9" />
          ) : (
            <Mic className="w-10 h-10" />
          )}
        </motion.button>

        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-base font-bold text-[var(--text-primary)]">
            {isRecording
              ? `Listening to baby... (${secondsLeft.toFixed(1)}s left)`
              : analyzing
                ? 'Checking what baby needs...'
                : 'What is baby telling you?'}
          </span>
          <span className="text-xs text-[var(--text-secondary)] max-w-md">
            {isRecording
              ? 'Hold phone gently near baby. It will stop automatically after 5 seconds.'
              : 'Tap once. Hold your phone near baby.'}
          </span>
        </div>

        {/* 24-Bar Acoustic Visualizer */}
        <div
          className="w-full max-w-md h-12 flex items-end justify-center gap-1 px-4"
          aria-hidden="true"
        >
          {spectrumBars.map((height, idx) => (
            <div
              key={idx}
              className={`w-1.5 rounded-full transition-all duration-150 ${
                isRecording
                  ? 'bg-rose-400'
                  : analyzing
                    ? 'bg-amber-400'
                    : 'bg-stone-600/50'
              }`}
              style={{
                height: `${Math.max(15, height)}%`,
              }}
            />
          ))}
        </div>

        {lastAudioUrl && !isRecording && (
          <button
            type="button"
            onClick={toggleReplaySample}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <Play className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>
              {isPlayingSample
                ? 'Stop Playing'
                : 'Listen to Recorded 5-Second Clip'}
            </span>
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-200 leading-relaxed">
          {errorMessage}
        </div>
      )}

      {/* Friendly Sample Baby Cries Bar for Practice / Testing */}
      <div className="pt-4 border-t border-[var(--border-subtle)] flex flex-col gap-2.5">
        <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <span>
            No baby crying right now? Tap a sample cry below to see how it
            works:
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {(
            [
              {
                id: 'hunger',
                label: 'Hungry Cry',
                sub: 'Short rhythmic "Neh"',
              },
              {
                id: 'gas',
                label: 'Tummy Gas Cry',
                sub: 'Tight tummy sound',
              },
              {
                id: 'overtired',
                label: 'Sleepy / Tired Cry',
                sub: 'Yawning "Owh" sound',
              },
              {
                id: 'discomfort',
                label: 'Wet Diaper / Fussy',
                sub: 'Breathy "Heh" sound',
              },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={isRecording || analyzing}
              onClick={() => handleRunReferenceCry(item.id)}
              className={`min-h-[52px] px-3.5 py-2.5 rounded-xl border text-left transition-colors flex flex-col justify-between ${
                activePreset === item.id
                  ? 'bg-amber-400/15 border-amber-400/50 text-[var(--text-primary)]'
                  : 'bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]'
              } disabled:opacity-50`}
            >
              <span className="text-xs font-bold whitespace-nowrap truncate">
                {item.label}
              </span>
              <span className="text-[11px] text-[var(--text-secondary)] truncate">
                {item.sub}
              </span>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
