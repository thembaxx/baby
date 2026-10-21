# Kora · Nocturne Cry

An experimental infant-audio interface with recording, interactive 3D presentation and configurable model integrations.

[Browse the source](https://github.com/thembaxx/baby)

## Engineering highlights

Browser audio capture, typed analysis schemas and local/server model paths. This is an experimental software project, not clinically validated diagnosis or infant-care advice.

## Technology

Declared in [package.json](package.json): Next.js `^15.4.9` · React `^19.2.1` · TypeScript `5.9.3` · Tailwind CSS `4.1.11` · Three.js `^0.186.1` · Motion `^12.23.24` · Google Gen AI SDK `^2.4.0` · Zod `^4.6.7`.

**Quality tooling:** `lint` scripts are available. See the setup guide below for prerequisites; this documentation pass does not assert that those checks were run.

---

## Project guide

Privacy-first 3D infant cry audio analyzer powered by local **Ollama (`qwen2-audio`)** and the **Vercel AI SDK (`ai`)**, with automatic server-side Gemini multimodal fallback, interactive **Three.js / WebGL** 3D acoustic resonance totems, hands-free voice control, neural TTS, optional in-browser **IndexedDB** offline model packs, and full **PWA** installability.

## Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Pull local multimodal audio model in Ollama
ollama pull qwen2-audio

# 3. Serve Ollama with 24h warm memory for instant 3:00 AM cry checks
OLLAMA_KEEP_ALIVE=24h ollama serve

# 4. Run Next.js development server
npm run dev
```

## Nursery screens

Kora has three icon-only tabs in a floating, theme-aware bottom bar:

- **Soothe:** cry recording and translation, soothing checklist and timer, calming sounds, and voice controls. Expand the probability breakdown for more detail; enable the optional 3D orb in Settings.
- **Care:** routine check-ins, family care log and reminders, medication schedules, sleep trends, and family handoff notes.
- **Settings:** lighting themes (including live system appearance), caregiver view, larger text, 3D visualization, vibration strength, screen wake lock, reading voices, app installation, and offline/local AI options.

Preferences and care logs are saved locally. Switching tabs preserves audio, timers, checklists, drafts, and each screen’s scroll position. Motion follows the device’s Reduce Motion preference. The tab bar supports arrow keys, Home, and End.

## Free reading voices

Settings → Reading voice lists the speech voices available on the device, with a preview and adjustable pace. These need no app download; availability and offline support depend on the browser and operating system.

The optional **More free voices** pack adds Heart, Bella, Michael, and Emma from Apache-2.0-licensed [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M). Its quantized model, four voices, and WebAssembly runtime total about **117 MB**. Nothing downloads until the user selects **Download free voice pack**. Once prepared, speech runs in a browser worker, works offline, and never sends reading text to a server. The selected voice and pace apply to all read-aloud controls. Downloads can be cancelled or removed; clearing browser site data also removes them.

Downloads require HTTPS (or localhost), Cache Storage, workers, WebAssembly, and sufficient device memory/storage. The build and dev scripts copy the installed ONNX browser runtime into the generated, ignored `public/voice-runtime/` directory. No TTS API key is needed. The legacy `/api/tts` endpoint is not used by the interface.

## Architecture Highlights

- **`components/CryRecorder.tsx`**: 5.0-second browser `MediaRecorder` capture (`audio/webm`, `audio/mp4`, or 16 kHz PCM WAV) with real-time 24-bar Web Audio FFT spectrum visualization and 4 built-in pediatric Dunstan cry acoustic synthesizers (*Hunger "Neh"*, *Gas / Colic "Eairh"*, *Overtired "Owh"*, *Discomfort "Heh"*).
- **`app/api/classify-cry/route.ts`**: Uses `generateObject` from `ai` and `createOpenAI` from `@ai-sdk/openai` pointed at `http://localhost:11434/v1` (`qwen2-audio`) with strict Zod schema validation (`CryAnalysisSchema`), plus automatic multimodal fallback.
- **`components/AcousticOrb3D.tsx`**: 10-part procedural Three.js / WebGL PBR sculpture (`RoomEnvironment` PMREM reflections, `ACESFilmicToneMapping`, anisotropic brushed gold, clearcoat ceramic, refractive glass) with interactive raycasting on orbiting cry-axis nodes, exploded view slider (`0%–100%`), and Wavefront `.OBJ` export for Blender and Unity.
- **`components/VoiceControlBar.tsx`, `hooks/useNurseryVoice.ts` & `lib/voice.worker.ts`**: Hands-free recognition commands, shared device speech, and optional local Kokoro speech. Voice preferences and offline downloads live in `components/VoiceSettings.tsx`.
- **`components/OfflineModelManager.tsx`**: Optional in-browser `IndexedDB` quantized acoustic weights downloader (`navigator.storage.persist()`) and custom Ollama `Modelfile` exporter.
- **Full PWA & SEO**: Includes `app/manifest.ts`, service worker (`/sw.js`), `192x192` / `512x512` / `maskable` / `apple-touch-icon.png` assets, `/llm.txt`, `/llms.txt`, `/robots.txt`, and `/sitemap.xml`.


## EasyUI UI adaptations

The settings vibration-strength control, caregiver card hover glow and an expandable model/privacy explanation adapt [EasyUI](https://easyui.site/components/). They retain the existing Motion dependency and honor reduced motion. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
