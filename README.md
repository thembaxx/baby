# Kora (Nocturne Cry) — 3D Infant Cry Studio & Tactile Nursery Companion

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

## Architecture Highlights

- **`components/CryRecorder.tsx`**: 5.0-second browser `MediaRecorder` capture (`audio/webm`, `audio/mp4`, or 16 kHz PCM WAV) with real-time 24-bar Web Audio FFT spectrum visualization and 4 built-in pediatric Dunstan cry acoustic synthesizers (*Hunger "Neh"*, *Gas / Colic "Eairh"*, *Overtired "Owh"*, *Discomfort "Heh"*).
- **`app/api/classify-cry/route.ts`**: Uses `generateObject` from `ai` and `createOpenAI` from `@ai-sdk/openai` pointed at `http://localhost:11434/v1` (`qwen2-audio`) with strict Zod schema validation (`CryAnalysisSchema`), plus automatic multimodal fallback.
- **`components/AcousticOrb3D.tsx`**: 10-part procedural Three.js / WebGL PBR sculpture (`RoomEnvironment` PMREM reflections, `ACESFilmicToneMapping`, anisotropic brushed gold, clearcoat ceramic, refractive glass) with interactive raycasting on orbiting cry-axis nodes, exploded view slider (`0%–100%`), and Wavefront `.OBJ` export for Blender and Unity.
- **`components/VoiceControlBar.tsx` & `app/api/tts/route.ts`**: Hands-free speech recognition commands and server-side `gemini-3.8-flash-lite-tts` soothing voice readout.
- **`components/OfflineModelManager.tsx`**: Optional in-browser `IndexedDB` quantized acoustic weights downloader (`navigator.storage.persist()`) and custom Ollama `Modelfile` exporter.
- **Full PWA & SEO**: Includes `app/manifest.ts`, service worker (`/sw.js`), `192x192` / `512x512` / `maskable` / `apple-touch-icon.png` assets, `/llm.txt`, `/llms.txt`, `/robots.txt`, and `/sitemap.xml`.
