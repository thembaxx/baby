'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  SpeakerHigh as Volume2,
  Play,
  Square,
  Clock,
} from '@phosphor-icons/react';

type SoundMode = 'brown' | 'pink' | 'heartbeat' | 'shush';

const SOUND_PROFILES: {
  id: SoundMode;
  title: string;
  subtitle: string;
  targetFreq: string;
}[] = [
  {
    id: 'brown',
    title: 'Womb Brown Noise',
    subtitle: 'Deep low-pass rumble mimicking intrauterine acoustics',
    targetFreq: '60–250 Hz',
  },
  {
    id: 'pink',
    title: 'Steady Nursery Rain',
    subtitle: 'Balanced octave-filtered pink noise for sleep maintenance',
    targetFreq: '100–1200 Hz',
  },
  {
    id: 'heartbeat',
    title: 'Resting Heartbeat',
    subtitle: '60 BPM lub-dub pulse for contact nap & swaddle calming',
    targetFreq: '60 BPM',
  },
  {
    id: 'shush',
    title: 'Rhythmic Shusher',
    subtitle: 'Breath-paced sibilant envelope for colic reflex calming',
    targetFreq: '0.4 Hz cycle',
  },
];

function createNoiseBuffer(ctx: AudioContext, mode: SoundMode) {
  const bufferSize = ctx.sampleRate * 3;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = noiseBuffer.getChannelData(0);

  let lastOut = 0.0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    if (mode === 'brown') {
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 3.2;
    } else {
      output[i] = (lastOut + 0.08 * white) / 1.08;
      lastOut = output[i];
      output[i] *= 1.8;
    }
  }

  return noiseBuffer;
}

export function SoundscapePlayer({
  onTimerExpired,
}: {
  onTimerExpired?: () => void;
} = {}) {
  const [activeMode, setActiveMode] = useState<SoundMode>('brown');
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.45);
  const [timerMinutes, setTimerMinutes] = useState<number | null>(15);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const modIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const stopAudio = useCallback(() => {
    if (modIntervalRef.current) {
      clearInterval(modIntervalRef.current);
      modIntervalRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    gainNodeRef.current = null;
    setIsPlaying(false);
    setRemainingSeconds(null);
  }, []);

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [stopAudio]);

  useEffect(() => {
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.setTargetAtTime(
        volume,
        audioCtxRef.current.currentTime,
        0.08
      );
    }
  }, [volume]);

  const startSound = (mode: SoundMode) => {
    stopAudio();
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const masterGain = ctx.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(ctx.destination);
    gainNodeRef.current = masterGain;

    if (mode === 'brown' || mode === 'pink' || mode === 'shush') {
      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = createNoiseBuffer(ctx, mode);
      whiteNoise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = mode === 'shush' ? 'bandpass' : 'lowpass';
      filter.frequency.value =
        mode === 'brown' ? 280 : mode === 'pink' ? 950 : 1800;

      const envGain = ctx.createGain();
      envGain.gain.value = mode === 'shush' ? 0.2 : 1.0;

      whiteNoise.connect(filter);
      filter.connect(envGain);
      envGain.connect(masterGain);
      whiteNoise.start(0);

      if (mode === 'shush') {
        let phase = 0;
        modIntervalRef.current = setInterval(() => {
          if (!audioCtxRef.current) return;
          phase += 0.15;
          const swell = 0.15 + 0.85 * Math.pow(Math.max(0, Math.sin(phase)), 2);
          envGain.gain.setTargetAtTime(
            swell,
            audioCtxRef.current.currentTime,
            0.08
          );
        }, 100);
      }
    } else if (mode === 'heartbeat') {
      const triggerPulse = () => {
        if (!audioCtxRef.current || !gainNodeRef.current) return;
        const now = audioCtxRef.current.currentTime;

        const playThump = (offset: number, freq: number, amp: number) => {
          if (!audioCtxRef.current || !gainNodeRef.current) return;
          const osc = audioCtxRef.current.createOscillator();
          const pulseGain = audioCtxRef.current.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + offset);
          osc.frequency.exponentialRampToValueAtTime(32, now + offset + 0.14);

          pulseGain.gain.setValueAtTime(0.001, now + offset);
          pulseGain.gain.linearRampToValueAtTime(amp, now + offset + 0.02);
          pulseGain.gain.exponentialRampToValueAtTime(
            0.001,
            now + offset + 0.16
          );

          osc.connect(pulseGain);
          pulseGain.connect(gainNodeRef.current);
          osc.start(now + offset);
          osc.stop(now + offset + 0.18);
        };

        playThump(0, 68, 0.9);
        playThump(0.24, 54, 0.6);
      };

      triggerPulse();
      modIntervalRef.current = setInterval(triggerPulse, 1000);
    }

    setIsPlaying(true);

    setRemainingSeconds(timerMinutes === null ? null : timerMinutes * 60);
  };

  const timerExpiredRef = useRef(onTimerExpired);
  useEffect(() => {
    timerExpiredRef.current = onTimerExpired;
  }, [onTimerExpired]);

  useEffect(() => {
    if (!isPlaying || remainingSeconds === null) return;
    const timer = setTimeout(() => {
      if (remainingSeconds <= 1) {
        stopAudio();
        timerExpiredRef.current?.();
      } else {
        setRemainingSeconds(remainingSeconds - 1);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [isPlaying, remainingSeconds, stopAudio]);

  // Keep browser media controls synchronized with playback, outside React rendering.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    session.playbackState = isPlaying ? 'playing' : 'paused';
    if (!isPlaying) return;
    const profile = SOUND_PROFILES.find((item) => item.id === activeMode);
    session.metadata = new MediaMetadata({
      title: profile?.title || 'Kora Nursery Soundscape',
      artist: 'Kora Acoustic Studio',
      album: '3:00 AM Soothing Frequencies',
      artwork: [
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
    });
    session.setActionHandler('pause', stopAudio);
    session.setActionHandler('stop', stopAudio);
    return () => {
      session.setActionHandler('pause', null);
      session.setActionHandler('stop', null);
      session.playbackState = 'paused';
    };
  }, [activeMode, isPlaying, stopAudio]);

  const handleSelectMode = (mode: SoundMode) => {
    setActiveMode(mode);
    if (isPlaying) {
      startSound(mode);
    }
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-6 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            Calming sounds
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Familiar sounds for a softer moment.
          </p>
        </div>

        <button
          type="button"
          onClick={() => (isPlaying ? stopAudio() : startSound(activeMode))}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
            isPlaying
              ? 'bg-rose-500 hover:bg-rose-400 text-white'
              : 'bg-[var(--accent-primary)] hover:opacity-95 text-stone-950'
          }`}
        >
          {isPlaying ? (
            <>
              <Square weight="fill" className="w-3.5 h-3.5" />
              <span>Stop Soundscape</span>
            </>
          ) : (
            <>
              <Play weight="fill" className="w-3.5 h-3.5" />
              <span>Start Soothing Audio</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {SOUND_PROFILES.map((profile) => {
          const isSelected = activeMode === profile.id;
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => handleSelectMode(profile.id)}
              className={`min-h-[60px] p-3.5 rounded-2xl border text-left transition-colors flex flex-col justify-between ${
                isSelected
                  ? 'bg-amber-400/12 border-amber-400/40 text-[var(--text-primary)]'
                  : 'bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]'
              }`}
            >
              <span className="flex items-center justify-between gap-2 w-full">
                <span className="text-xs font-semibold">{profile.title}</span>
                <span className="text-[11px] font-mono tabular-nums text-[var(--text-secondary)]">
                  {profile.targetFreq}
                </span>
              </span>
              <span className="text-[11px] text-[var(--text-secondary)] mt-1 line-clamp-1 block">
                {profile.subtitle}
              </span>
            </button>
          );
        })}
      </div>

      {/* Volume & Auto-Fade Sleep Timer Controls */}
      <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <Volume2 className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
          <input
            type="range"
            min={0.05}
            max={0.9}
            step={0.05}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            aria-label="Soothing soundscape volume"
            className="w-full accent-amber-400 cursor-pointer"
          />
          <span className="text-xs font-mono tabular-nums text-[var(--text-primary)] w-10 text-right">
            {Math.round(volume * 100)}%
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-[var(--text-secondary)] mr-1 shrink-0" />
          {[15, 30, 60, null].map((mins) => (
            <button
              key={mins === null ? 'inf' : mins}
              type="button"
              onClick={() => {
                setTimerMinutes(mins);
                if (isPlaying) {
                  setRemainingSeconds(mins ? mins * 60 : null);
                }
              }}
              className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                timerMinutes === mins
                  ? 'bg-[var(--bg-elevated)] text-[var(--accent-primary)] border border-amber-400/30'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {mins === null ? 'Continuous' : `${mins}m`}
            </button>
          ))}
          {isPlaying && remainingSeconds !== null && (
            <span className="ml-2 text-xs font-mono tabular-nums text-[var(--accent-primary)]">
              {formatTimer(remainingSeconds)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
