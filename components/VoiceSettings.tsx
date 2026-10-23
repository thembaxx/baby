"use client";

import {
  CaretDown,
  CheckCircle,
  DownloadSimple,
  Play,
  SpeakerHigh,
  Square,
  Trash,
  Waveform,
} from "@phosphor-icons/react";
import { FREE_VOICES } from "@/lib/voice-options";
import type { NurseryVoice } from "@/hooks/useNurseryVoice";

const PREVIEW = "Take a gentle breath. We can go one little step at a time.";

export function VoiceSettings({ voice }: { voice: NurseryVoice }) {
  const active = voice.status !== "idle";
  return (
    <section className="settings-section voice-settings" aria-labelledby="voice-title">
      <div className="settings-section-heading">
        <h2 id="voice-title">Reading voice</h2>
        <p>A familiar voice for calming steps and care updates. Always free.</p>
      </div>
      <div className="voice-device-row">
        <label className="voice-device-picker">
          <span>Device voice</span>
          <select
            value={
              voice.preferences.voice.startsWith("device:") ? voice.preferences.voice : "downloaded"
            }
            onChange={(event) => voice.setVoice(event.target.value)}
          >
            {!voice.preferences.voice.startsWith("device:") && (
              <option value="downloaded" disabled>
                Using a downloaded voice
              </option>
            )}
            <option value="device:default">Device default</option>
            {voice.deviceVoices.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.language}
                {item.local ? " · on device" : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="quiet-action"
          onClick={() => (active ? voice.stop() : void voice.speak(PREVIEW))}
        >
          {active ? (
            <Square size={16} weight="fill" aria-hidden="true" />
          ) : (
            <SpeakerHigh size={18} aria-hidden="true" />
          )}
          {active ? "Stop preview" : "Preview voice"}
        </button>
      </div>
      <label className="voice-rate">
        <span>
          Reading pace <span>{Math.round(voice.preferences.rate * 100)}%</span>
        </span>
        <input
          type="range"
          min="0.8"
          max="1.2"
          step="0.05"
          value={voice.preferences.rate}
          onChange={(event) => voice.setRate(Number(event.target.value))}
        />
        <span className="voice-rate-labels">
          <span>Slower</span>
          <span>Faster</span>
        </span>
      </label>
      <details className="voice-pack">
        <summary>
          <Waveform size={22} aria-hidden="true" />
          <span>
            <strong>More free voices</strong>
            <small>
              {voice.packReady
                ? "Downloaded · ready offline"
                : voice.packStored
                  ? "Saved voices need an update"
                  : "Optional download · about 117 MB"}
            </small>
          </span>
          <CaretDown size={18} aria-hidden="true" />
        </summary>
        <div className="voice-pack-content">
          <p>
            Heart, Bella, Michael, and Emma speak entirely on your device. Download once to preview
            and use all four offline. Your text stays here.
          </p>
          <div className="voice-library" role="group" aria-label="Downloaded voices">
            {FREE_VOICES.map((item) => (
              <div
                key={item.id}
                className="voice-option"
                data-selected={voice.preferences.voice === item.id}
              >
                <label>
                  <input
                    type="radio"
                    name="reading-voice"
                    value={item.id}
                    checked={voice.preferences.voice === item.id}
                    disabled={!voice.packReady || voice.removing}
                    onChange={() => voice.setVoice(item.id)}
                  />
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.description}</small>
                  </span>
                </label>
                <button
                  type="button"
                  className="voice-sample"
                  disabled={!voice.packReady || voice.removing}
                  aria-label={`Preview ${item.name}`}
                  title={`Preview ${item.name}`}
                  onClick={() => void voice.speak(PREVIEW, item.id)}
                >
                  <Play size={18} weight="fill" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          {voice.downloading ? (
            <div className="voice-download-progress">
              <span id="voice-download-label" role="status">
                {voice.progress >= 95
                  ? "Preparing your voices…"
                  : `Downloading voices · ${voice.progress}%`}
              </span>
              <progress max={100} value={voice.progress} aria-labelledby="voice-download-label" />
              <button type="button" className="quiet-action" onClick={voice.cancelDownload}>
                Cancel download
              </button>
            </div>
          ) : voice.packReady ? (
            <div className="voice-pack-actions">
              <span>
                <CheckCircle size={18} weight="fill" aria-hidden="true" />
                Ready offline
              </span>
              <button
                type="button"
                className="quiet-action"
                onClick={() => void voice.remove()}
                disabled={voice.removing}
              >
                <Trash size={16} aria-hidden="true" />
                {voice.removing ? "Removing…" : "Remove download"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="quiet-action voice-download-button"
              onClick={() => void voice.download()}
              disabled={voice.packChecking || voice.removing}
            >
              <DownloadSimple size={18} aria-hidden="true" />
              {voice.packChecking ? "Checking saved voices…" : "Download free voice pack"}
            </button>
          )}
          {voice.packStored && !voice.packReady && !voice.downloading && (
            <button
              type="button"
              className="quiet-action voice-download-button"
              disabled={voice.removing}
              onClick={() => void voice.remove()}
            >
              <Trash size={16} aria-hidden="true" />
              {voice.removing ? "Removing…" : "Remove download"}
            </button>
          )}
          <p className="voice-attribution">
            Powered by{" "}
            <a href="https://huggingface.co/hexgrad/Kokoro-82M" target="_blank" rel="noreferrer">
              Kokoro
            </a>{" "}
            ·{" "}
            <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noreferrer">
              Apache 2.0
            </a>
            . Saved in this browser; clearing site data removes the download.
          </p>
        </div>
      </details>
      {voice.status === "preparing" && (
        <p role="status" className="voice-feedback">
          Preparing speech on your device…
        </p>
      )}
      {voice.error && (
        <p role="alert" className="voice-feedback">
          {voice.error}
        </p>
      )}
    </section>
  );
}
