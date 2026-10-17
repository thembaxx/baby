'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Play, Square, Clock } from 'lucide-react';

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

export function SoundscapePlayer() {
  const [activeMode, setActiveMode] = useState<SoundMode>('brown');
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.45);
  const [timerMinutes, setTimerMinutes] = useState<number | null>(15);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const modIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const stopAudio = () => {
    if (modIntervalRef.current) {
      clearInterval(modIntervalRef.current);
      modIntervalRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    gainNodeRef.current = null;
    setIsPlaying(false);
    setRemainingSeconds(null);
  };

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

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

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
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

    if (timerMinutes) {
      setRemainingSeconds(timerMinutes * 60);
      countdownRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev === null || prev <= 1) {
            stopAudio();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

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
    <div className="p-6 rounded-3xl bg-white/[0.04] border border-white/[0.08] flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-stone-100">
            Nocturnal Soothing Soundscape
          </h3>
          <p className="text-xs text-stone-400 mt-0.5">
            Zero-latency Web Audio acoustic generator for post-cry settling
          </p>
        </div>

        <button
          type="button"
          onClick={() => (isPlaying ? stopAudio() : startSound(activeMode))}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
            isPlaying
              ? 'bg-rose-500 hover:bg-rose-400 text-white'
              : 'bg-amber-400 hover:bg-amber-300 text-stone-950'
          }`}
        >
          {isPlaying ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop Soundscape</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
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
                  ? 'bg-amber-400/12 border-amber-400/40 text-stone-100'
                  : 'bg-stone-900/60 hover:bg-stone-900 border-white/[0.06] text-stone-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">{profile.title}</span>
                <span className="text-[11px] font-mono tabular-nums text-stone-400">
                  {profile.targetFreq}
                </span>
              </div>
              <p className="text-[11px] text-stone-400 mt-1 line-clamp-1">
                {profile.subtitle}
              </p>
            </button>
          );
        })}
      </div>

      {/* Volume & Auto-Fade Sleep Timer Controls */}
      <div className="pt-3 border-t border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <Volume2 className="w-4 h-4 text-stone-400 shrink-0" />
          <input
            type="range"
            min={0.05}
            max={0.9}
            step={0.05}
            value={volume}
            onChange={(e) => setVolume( parseFloat(e.target.value) )}
            aria-label="Soothing soundscape volume"
            className="w-full accent-amber-400 cursor-pointer"
          />
          <span className="text-xs font-mono tabular-nums text-stone-300 w-10 text-right">
            {Math.round(volume * 100)}%
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-stone-400 mr-1 shrink-0" />
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
                  ? 'bg-stone-800 text-amber-300 border border-amber-400/30'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {mins === null ? 'Continuous' : `${mins}m`}
            </button>
          ))}
          {isPlaying && remainingSeconds !== null && (
            <span className="ml-2 text-xs font-mono tabular-nums text-amber-300">
              {formatTimer(remainingSeconds)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
