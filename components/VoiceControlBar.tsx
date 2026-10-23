"use client";

import React, { useState, useRef, useEffect } from "react";
import { SpeakerHigh as Volume2, Microphone as Mic, Square } from "@phosphor-icons/react";
import type { CryPresetKey } from "@/components/AcousticOrb3D";

interface VoiceControlBarProps {
  onReadAloud: () => void;
  onPrepareSpeech: () => void;
  speechStatus: "idle" | "preparing" | "speaking";
  speechError: string | null;
  onTriggerPresetCry: (preset: CryPresetKey) => void;
  onQuickLog: (type: "feed" | "diaper" | "sleep") => void;
}

export function VoiceControlBar({
  onReadAloud,
  onPrepareSpeech,
  speechStatus,
  speechError,
  onTriggerPresetCry,
  onQuickLog,
}: VoiceControlBarProps) {
  const speaking = speechStatus !== "idle";
  const [listeningCmd, setListeningCmd] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleHandsFreeVoiceCommand = () => {
    if (listeningCmd) {
      recognitionRef.current?.stop();
      setListeningCmd(false);
      return;
    }

    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown })
        .webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setVoiceTranscript(
        'Voice recognition is supported in Chrome, Edge, and Safari. Try clicking "Read Soothing Steps Aloud".',
      );
      return;
    }

    const recognition = new SpeechRecognitionCtor() as {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      start: () => void;
      stop: () => void;
      onresult: (event: {
        results: { [index: number]: { [index: number]: { transcript: string } } };
      }) => void;
      onerror: () => void;
      onend: () => void;
    };

    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const spoken = event.results?.[0]?.[0]?.transcript?.toLowerCase()?.trim() || "";
      setVoiceTranscript(`Heard: "${spoken}"`);

      if (spoken.includes("hunger") || spoken.includes("hungry")) {
        onTriggerPresetCry("hunger");
      } else if (spoken.includes("gas") || spoken.includes("colic")) {
        onTriggerPresetCry("gas");
      } else if (spoken.includes("tired") || spoken.includes("sleep")) {
        if (spoken.includes("log")) {
          onQuickLog("sleep");
        } else {
          onTriggerPresetCry("overtired");
        }
      } else if (spoken.includes("diaper") || spoken.includes("discomfort")) {
        if (spoken.includes("log")) {
          onQuickLog("diaper");
        } else {
          onTriggerPresetCry("discomfort");
        }
      } else if (spoken.includes("feed")) {
        onQuickLog("feed");
      } else if (spoken.includes("read") || spoken.includes("sooth") || spoken.includes("speak")) {
        onReadAloud();
      }
    };

    recognition.onerror = () => {
      setListeningCmd(false);
    };
    recognition.onend = () => {
      setListeningCmd(false);
    };

    recognitionRef.current = recognition;
    onPrepareSpeech();
    setListeningCmd(true);
    setVoiceTranscript(
      'Listening... Say "Read soothing steps", "Simulate hunger", "Log feeding", or "Log diaper"',
    );
    recognition.start();
  };

  return (
    <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="text-xs font-semibold text-[var(--text-primary)]">
          A little hands-free help
        </div>
        <div className="text-xs text-[var(--text-secondary)] truncate">
          {speechError ||
            (speechStatus === "preparing" ? "Preparing speech on your device…" : null) ||
            voiceTranscript ||
            "Speak commands while holding your baby or hear soothing instructions read aloud"}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggleHandsFreeVoiceCommand}
          className={`min-h-[40px] px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
            listeningCmd
              ? "bg-rose-500 text-white border-rose-400"
              : "bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]"
          }`}
        >
          <Mic className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span>{listeningCmd ? "Listening..." : "Voice Command"}</span>
        </button>

        <button
          type="button"
          onClick={onReadAloud}
          className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
            speaking
              ? "bg-rose-500 text-white"
              : "bg-[var(--accent-primary)] text-stone-950 hover:opacity-95"
          }`}
        >
          {speaking ? (
            <>
              <Square weight="fill" className="w-3.5 h-3.5" />
              <span>{speechStatus === "preparing" ? "Cancel speech" : "Stop Voice"}</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5" />
              <span>Read Soothing Steps</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
