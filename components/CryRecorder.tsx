'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Loader2, Play, Square, Upload, Volume2, VolumeX } from 'lucide-react';
import type { CryAnalysisResult } from '@/app/api/classify-cry/route';

interface CryRecorderProps {
  onClassificationResult: (res: CryAnalysisResult, audioUrl?: string) => void;
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

function createSynthesizedCryWavBlob(
  preset: 'hunger' | 'gas' | 'overtired' | 'discomfort'
): Blob {
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
      preset === 'overtired' ? -35 * (t % 1.4) : preset === 'gas' ? 45 * envelope : 0;
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
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    };
  }, []);

  const stopAllTimers = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    setSpectrumBars(Array.from({ length: 24 }, () => 12));
  };

  const startRecording = async () => {
    setErrorMessage(null);
    setActivePreset(null);
    audioChunksRef.current = [];

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

      // Set up live frequency analyzer for tactile 3:00 AM visual confirmation
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateSpectrum = () => {
        analyser.getByteFrequencyData(dataArray);
        const bars = Array.from({ length: 24 }, (_, idx) => {
          const val = dataArray[idx % dataArray.length] || 0;
          return Math.max(10, Math.min(100, Math.round((val / 255) * 100)));
        });
        setSpectrumBars(bars);
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
      setSecondsLeft(5.0);

      const startedAt = Date.now();
      countdownIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startedAt) / 1000;
        const remaining = Math.max(0, 5.0 - elapsed);
        setSecondsLeft(Number(remaining.toFixed(1)));
      }, 100);

      // Automatically stop and analyze after exactly 5 seconds
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
        'Microphone access was blocked or unavailable. Use one of the Reference Cry Acoustic Samples below to test the local inference pipeline.'
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

  const analyzeAudioClip = async (
    blob: Blob,
    mimeType = 'audio/webm',
    presetHint?: string,
    audioUrl?: string
  ) => {
    setAnalyzing(true);
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
          onClassificationResult(result, audioUrl);
        } catch (innerErr) {
          console.error('Cry analysis request failed:', innerErr);
          setErrorMessage('Failed to classify audio sample.');
        } finally {
          setAnalyzing(false);
        }
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('Cry analysis error:', err);
      setAnalyzing(false);
    }
  };

  const handleRunReferenceCry = async (
    preset: 'hunger' | 'gas' | 'overtired' | 'discomfort'
  ) => {
    if (isRecording || analyzing) return;
    setActivePreset(preset);
    const wavBlob = createSynthesizedCryWavBlob(preset);
    const url = URL.createObjectURL(wavBlob);
    setLastAudioUrl(url);

    // Animate waveform briefly while synthesizing & analyzing
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
    <div className="flex flex-col gap-5 p-6 rounded-3xl bg-white/[0.04] border border-white/[0.08]">
      {/* Top Status & Controls Row */}
      <div className="flex items-center justify-between gap-4">
        <div className="text-xs text-stone-400">
          <span>5.0s Acoustic Capture</span>
          <span aria-hidden="true" className="mx-2 text-stone-600">
            ·
          </span>
          <span className="font-mono tabular-nums text-stone-300">
            {ollamaConfig?.model || 'qwen2-audio'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMutePreview((prev) => !prev)}
            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-stone-900/80 hover:bg-stone-800 border border-white/[0.08] text-xs text-stone-300 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            title="Toggle reference audio preview sound"
          >
            {mutePreview ? (
              <VolumeX className="w-3.5 h-3.5 text-stone-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>{mutePreview ? 'Muted (3 AM Mode)' : 'Audio Preview On'}</span>
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
            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-stone-900/80 hover:bg-stone-800 border border-white/[0.08] text-xs text-stone-300 flex items-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5 text-stone-400" />
            <span>Upload Clip</span>
          </button>
        </div>
      </div>

      {/* Main 5-Second Mic Trigger + Waveform Visualizer */}
      <div className="flex flex-col items-center justify-center py-4 gap-4">
        <div className="relative flex items-center justify-center">
          <button
            type="button"
            onClick={isRecording ? stopRecordingEarly : startRecording}
            disabled={analyzing}
            aria-label={isRecording ? 'Stop recording' : 'Tap to Decode Cry'}
            className={`relative flex items-center justify-center w-24 h-24 rounded-full transition-all shadow-xl ${
              isRecording
                ? 'bg-rose-500 text-white ring-8 ring-rose-500/25 scale-105'
                : analyzing
                  ? 'bg-stone-800 text-amber-400 border border-amber-400/30'
                  : 'bg-amber-400 hover:bg-amber-300 text-stone-950 active:scale-95'
            }`}
          >
            {analyzing ? (
              <Loader2 className="w-9 h-9 animate-spin" />
            ) : isRecording ? (
              <Square className="w-8 h-8 fill-current" />
            ) : (
              <Mic className="w-9 h-9" />
            )}
          </button>
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-sm font-semibold text-stone-200">
            {isRecording
              ? `Listening to 5s cry sample... (${secondsLeft.toFixed(1)}s)`
              : analyzing
                ? 'Analyzing local audio...'
                : 'Tap to Decode Cry'}
          </span>
          <span className="text-xs text-stone-400">
            {isRecording
              ? 'Hold phone 30–50 cm from infant. Tap early to analyze immediately.'
              : 'Captures a 5-second PCM/WebM clip and streams base64 to /api/classify-cry'}
          </span>
        </div>

        {/* 24-Bar Acoustic Spectrum Visualizer */}
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
                    ? 'bg-amber-400/80'
                    : 'bg-stone-700/70'
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
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-white/[0.08] text-xs font-medium text-stone-300 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {isPlayingSample
                ? 'Stop Sample Playback'
                : 'Replay Captured 5s Audio Sample'}
            </span>
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-200 leading-relaxed">
          {errorMessage}
        </div>
      )}

      {/* Reference Cry Acoustic Synthesizer Bar for Instant Testing */}
      <div className="pt-4 border-t border-white/[0.08] flex flex-col gap-2.5">
        <div className="flex items-center justify-between text-xs text-stone-400">
          <span>Simulate 5s Reference Infant Cry (Synthesizes WAV & Calls API)</span>
          <span className="font-mono tabular-nums text-stone-500">16 kHz PCM</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(
            [
              { id: 'hunger', label: 'Hunger ("Neh")', freq: '420 Hz' },
              { id: 'gas', label: 'Gas / Colic ("Eairh")', freq: '610 Hz' },
              { id: 'overtired', label: 'Overtired ("Owh")', freq: '340 Hz' },
              { id: 'discomfort', label: 'Discomfort ("Heh")', freq: '480 Hz' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={isRecording || analyzing}
              onClick={() => handleRunReferenceCry(item.id)}
              className={`min-h-[44px] px-3 py-2 rounded-xl border text-left transition-colors flex flex-col justify-between ${
                activePreset === item.id
                  ? 'bg-amber-400/15 border-amber-400/40 text-amber-200'
                  : 'bg-stone-900/70 hover:bg-stone-900 border-white/[0.07] text-stone-300'
              } disabled:opacity-50`}
            >
              <span className="text-xs font-medium whitespace-nowrap truncate">
                {item.label}
              </span>
              <span className="text-[11px] font-mono tabular-nums text-stone-400">
                {item.freq}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
