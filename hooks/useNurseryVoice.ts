"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useClientReady } from "./use-client-ready";
import { readStoredValue } from "@/lib/storage";
import { hasVoicePack, removeVoicePack } from "@/lib/voice-cache";
import { startVoiceJob, type VoiceJob } from "@/lib/voice-worker-client";
import {
  DEFAULT_VOICE_PREFERENCES,
  isFreeVoice,
  type DeviceVoice,
  type VoicePreferences,
} from "@/lib/voice-options";

const VOICE_PREFERENCES_KEY = "kora_voice_preferences_v1";
const serverVoices = () => "[]";
function deviceVoicesSnapshot() {
  if (!("speechSynthesis" in window)) return "[]";
  return JSON.stringify(
    window.speechSynthesis.getVoices().map((voice) => ({
      id: `device:${voice.voiceURI}`,
      name: voice.name,
      language: voice.lang,
      local: voice.localService,
    })),
  );
}
function subscribeVoices(onChange: () => void) {
  if (!("speechSynthesis" in window)) return () => {};
  window.speechSynthesis.addEventListener("voiceschanged", onChange);
  return () =>
    window.speechSynthesis.removeEventListener("voiceschanged", onChange);
}
const aborted = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

export function useNurseryVoice() {
  const clientReady = useClientReady();
  const voicesSnapshot = useSyncExternalStore(
    subscribeVoices,
    deviceVoicesSnapshot,
    serverVoices,
  );
  const deviceVoices = useMemo<DeviceVoice[]>(
    () => JSON.parse(voicesSnapshot),
    [voicesSnapshot],
  );
  const [storedPreferences, setStoredPreferences] = useState<VoicePreferences>(
    () => {
      const saved = readStoredValue(
        VOICE_PREFERENCES_KEY,
        DEFAULT_VOICE_PREFERENCES,
      );
      return {
        voice:
          typeof saved.voice === "string" &&
          (saved.voice.startsWith("device:") || isFreeVoice(saved.voice))
            ? saved.voice
            : "device:default",
        rate:
          typeof saved.rate === "number" && Number.isFinite(saved.rate)
            ? Math.max(0.8, Math.min(1.2, saved.rate))
            : 0.95,
      };
    },
  );
  const preferences = clientReady
    ? storedPreferences
    : DEFAULT_VOICE_PREFERENCES;
  const [status, setStatus] = useState<"idle" | "preparing" | "speaking">(
    "idle",
  );
  const [packReady, setPackReady] = useState(false);
  const [packChecking, setPackChecking] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechJobRef = useRef<VoiceJob | null>(null);
  const downloadJobRef = useRef<VoiceJob | null>(null);
  const speechVersion = useRef(0);

  useEffect(() => {
    let active = true;
    void hasVoicePack()
      .then((ready) => {
        if (!active) return;
        setPackReady(ready);
        setPackChecking(false);
        if (!ready)
          setStoredPreferences((value) =>
            isFreeVoice(value.voice)
              ? { ...value, voice: "device:default" }
              : value,
          );
      })
      .catch(() => {
        if (active) setPackChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!clientReady) return;
    try {
      localStorage.setItem(
        VOICE_PREFERENCES_KEY,
        JSON.stringify(storedPreferences),
      );
    } catch {
      /* Speech still works without persistent preferences. */
    }
  }, [clientReady, storedPreferences]);

  const stop = useCallback(() => {
    speechVersion.current += 1;
    speechJobRef.current?.cancel();
    speechJobRef.current = null;
    if (sourceRef.current) {
      sourceRef.current.onended = null;
      sourceRef.current.stop();
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setStatus("idle");
  }, []);

  useEffect(
    () => () => {
      speechVersion.current += 1;
      speechJobRef.current?.cancel();
      downloadJobRef.current?.cancel();
      if (sourceRef.current) {
        sourceRef.current.onended = null;
        sourceRef.current.stop();
      }
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      void contextRef.current?.close();
    },
    [],
  );

  const playbackContext = () => {
    const AudioContextClass =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass)
      throw new Error(
        "Downloaded voices are unavailable in this browser. Choose a device voice.",
      );
    return (contextRef.current ||= new AudioContextClass());
  };
  const preparePlayback = () => {
    if (!isFreeVoice(preferences.voice)) return;
    // Unlock iOS audio during the command button tap, before recognition returns.
    try {
      void playbackContext()
        .resume()
        .catch(() => {});
    } catch {
      /* The read action reports unsupported audio if needed. */
    }
  };

  const speak = async (text: string, voice = preferences.voice) => {
    stop();
    setError(null);
    const version = speechVersion.current;
    try {
      if (isFreeVoice(voice)) {
        if (!packReady)
          throw new Error(
            "Download the optional voice pack in Settings first, or choose a device voice.",
          );
        const context = playbackContext();
        // Resume during the tap, before inference, to support iOS audio playback.
        await context.resume();
        if (version !== speechVersion.current) return;
        setStatus("preparing");
        const job = startVoiceJob({
          type: "speak",
          text,
          voice,
          rate: preferences.rate,
        });
        speechJobRef.current = job;
        const result = await job.promise;
        if (version !== speechVersion.current || result.type !== "audio")
          return;
        speechJobRef.current = null;
        const samples = new Float32Array(result.samples);
        if (!samples.length)
          throw new Error("No speech was generated. Please try again.");
        const buffer = context.createBuffer(
          1,
          samples.length,
          result.sampleRate,
        );
        buffer.copyToChannel(samples, 0);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.onended = () => {
          source.disconnect();
          if (version === speechVersion.current) {
            sourceRef.current = null;
            setStatus("idle");
          }
        };
        sourceRef.current = source;
        source.start();
        setStatus("speaking");
      } else {
        if (!("speechSynthesis" in window))
          throw new Error(
            "This browser does not provide device voices. You can use the optional voice pack instead.",
          );
        const utterance = new SpeechSynthesisUtterance(text);
        const uri = voice.slice("device:".length);
        if (uri !== "default") {
          const selected = window.speechSynthesis
            .getVoices()
            .find((item) => item.voiceURI === uri);
          if (selected) {
            utterance.voice = selected;
            utterance.lang = selected.lang;
          }
        }
        utterance.rate = preferences.rate;
        utterance.onend = () => {
          if (version === speechVersion.current) {
            setStatus("idle");
            utteranceRef.current = null;
          }
        };
        utterance.onerror = (event) => {
          if (version !== speechVersion.current) return;
          setStatus("idle");
          if (event.error !== "canceled" && event.error !== "interrupted")
            setError(
              "This device voice could not play. Try another voice or download the optional pack.",
            );
        };
        utteranceRef.current = utterance;
        setStatus("speaking");
        window.speechSynthesis.speak(utterance);
      }
    } catch (failure) {
      if (version !== speechVersion.current || aborted(failure)) return;
      speechJobRef.current = null;
      setStatus("idle");
      setError(
        failure instanceof Error
          ? failure.message
          : "The voice could not play. Please try again.",
      );
    }
  };

  const setVoice = (voice: string) => {
    if (isFreeVoice(voice) && !packReady) return;
    stop();
    setError(null);
    setStoredPreferences((value) => ({ ...value, voice }));
  };
  const setRate = (rate: number) => {
    stop();
    setStoredPreferences((value) => ({
      ...value,
      rate: Math.max(0.8, Math.min(1.2, rate)),
    }));
  };
  const download = async () => {
    if (downloadJobRef.current || packReady) return;
    setError(null);
    setDownloading(true);
    setProgress(0);
    try {
      if (!("caches" in window) || !("Worker" in window))
        throw new Error(
          "Voice downloads are unavailable in this browser. Device voices still work.",
        );
      const job = startVoiceJob({ type: "download" }, setProgress);
      downloadJobRef.current = job;
      await job.promise;
      if (!(await hasVoicePack()))
        throw new Error(
          "The voice pack was not saved completely. Check available storage and try again.",
        );
      setPackReady(true);
      setProgress(100);
      if (navigator.storage?.persist)
        void navigator.storage.persist().catch(() => {});
    } catch (failure) {
      // A cancelled or failed optional download must not leave hidden storage behind.
      await removeVoicePack().catch(() => {});
      setProgress(0);
      if (!aborted(failure))
        setError(
          failure instanceof Error
            ? failure.message
            : "The download failed. Please try again.",
        );
    } finally {
      downloadJobRef.current = null;
      setDownloading(false);
    }
  };
  const cancelDownload = () => {
    downloadJobRef.current?.cancel();
  };
  const remove = async () => {
    stop();
    setRemoving(true);
    setError(null);
    try {
      await removeVoicePack();
      setPackReady(false);
      setProgress(0);
      setStoredPreferences((value) =>
        isFreeVoice(value.voice)
          ? { ...value, voice: "device:default" }
          : value,
      );
    } catch {
      setError("The voice pack could not be removed. Please try again.");
    } finally {
      setRemoving(false);
    }
  };
  return {
    preferences,
    deviceVoices,
    status,
    error,
    packReady,
    packChecking,
    downloading,
    removing,
    progress,
    speak,
    preparePlayback,
    stop,
    setVoice,
    setRate,
    download,
    cancelDownload,
    remove,
  };
}

export type NurseryVoice = ReturnType<typeof useNurseryVoice>;
