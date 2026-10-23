import { env } from "@huggingface/transformers";
import { KokoroTTS, TextSplitterStream } from "kokoro-js";
import {
  FREE_VOICES,
  VOICE_MODEL,
  VOICE_REVISION,
  VOICE_PACK_CACHE,
  VOICE_PACK_MARKER,
  VOICE_VECTOR_CACHE,
  VOICE_MODEL_URL,
  VOICE_RUNTIME_VERSION,
  VOICE_RUNTIME_BASE,
  voiceVectorUrl,
  type VoiceWorkerRequest,
  type VoiceWorkerResponse,
} from "./voice-options";

const scope = self as unknown as {
  location: Location;
  onmessage: ((event: MessageEvent<VoiceWorkerRequest>) => void) | null;
  postMessage: (message: VoiceWorkerResponse, transfer?: Transferable[]) => void;
};
const send = (message: VoiceWorkerResponse) => scope.postMessage(message);

scope.onmessage = async ({ data }) => {
  try {
    const downloading = data.type === "download";
    const cache = await caches.open(VOICE_PACK_CACHE);
    const runtimeBase = new URL(VOICE_RUNTIME_BASE, scope.location.origin).href;
    const nativeFetch = globalThis.fetch.bind(globalThis);
    // Runtime files also live in the pack cache, so inference needs no network.
    globalThis.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith(runtimeBase)) {
        const cached = await cache.match(url);
        if (cached) return cached;
      }
      if (!downloading && url.startsWith("https://huggingface.co/")) {
        throw new Error("The saved voice pack is incomplete. Download it again.");
      }
      return nativeFetch(input, init);
    };
    if (downloading) {
      const manifest = await nativeFetch(
        new URL("/voice-runtime/manifest.json", scope.location.origin),
      ).then((response) => {
        if (!response.ok) throw new Error("Voice files could not be loaded. Please try again.");
        return response.json() as Promise<{ version: string; files: string[] }>;
      });
      if (manifest.version !== VOICE_RUNTIME_VERSION)
        throw new Error("The voice engine was updated. Reload the app and try the download again.");
      // Keep the large model, but discard runtime assets from older engines.
      for (const request of await cache.keys()) {
        const url = new URL(request.url);
        if (
          url.origin === scope.location.origin &&
          url.pathname.startsWith("/voice-runtime/") &&
          !request.url.startsWith(runtimeBase)
        )
          await cache.delete(request);
      }
      for (const file of manifest.files) {
        const url = new URL(`/voice-runtime/${file}`, scope.location.origin).href;
        if (!(await cache.match(url))) {
          const response = await nativeFetch(url);
          if (!response.ok) throw new Error("Voice runtime download failed. Please try again.");
          await cache.put(url, response);
        }
      }
      const vectors = await caches.open(VOICE_VECTOR_CACHE);
      for (const voice of FREE_VOICES) {
        const url = voiceVectorUrl(voice.id);
        if (!(await vectors.match(url))) {
          const response = await nativeFetch(url);
          if (!response.ok) throw new Error("Voice download failed. Please try again.");
          await vectors.put(url, response);
        }
      }
      send({ type: "progress", progress: 10 });
    }
    let cacheFailure: unknown;
    env.allowLocalModels = false;
    env.useBrowserCache = false;
    env.useFSCache = false;
    env.useCustomCache = true;
    env.remotePathTemplate = `{model}/resolve/${VOICE_REVISION}/`;
    env.customCache = {
      match: (request: Request | string) => cache.match(request),
      put: async (request: Request | string, response: Response) => {
        try {
          await cache.put(request, response);
        } catch (error) {
          cacheFailure = error;
          throw error;
        }
      },
    };
    const wasm = env.backends.onnx.wasm;
    if (wasm) {
      wasm.numThreads = 1;
      wasm.proxy = false;
      wasm.wasmPaths = {
        mjs: `${runtimeBase}ort-wasm-simd-threaded.jsep.mjs`,
        wasm: `${runtimeBase}ort-wasm-simd-threaded.jsep.wasm`,
      };
    }
    const tts = await KokoroTTS.from_pretrained(VOICE_MODEL, {
      dtype: "q8",
      device: "wasm",
      progress_callback: (progress) => {
        if (downloading && progress.status === "progress" && progress.file.endsWith(".onnx")) {
          send({
            type: "progress",
            progress: 10 + Math.round(progress.progress * 0.8),
          });
        }
      },
    });
    if (cacheFailure) throw cacheFailure;
    if (downloading) {
      send({ type: "progress", progress: 95 });
      // Exercise the phonemizer and runtime before advertising offline readiness.
      await tts.generate("A little calm.", { voice: "af_heart" });
      if (!(await cache.match(VOICE_MODEL_URL)))
        throw new Error("The voice model could not be saved. Check available storage and retry.");
      await cache.put(
        VOICE_PACK_MARKER,
        new Response(JSON.stringify({ version: 1, runtimeVersion: VOICE_RUNTIME_VERSION })),
      );
      send({ type: "ready" });
    } else {
      const chunks: Float32Array[] = [];
      let sampleRate = 24000;
      const sentences = new TextSplitterStream();
      sentences.push(data.text);
      sentences.close();
      for await (const { audio } of tts.stream(sentences, {
        voice: data.voice,
        speed: data.rate,
      })) {
        chunks.push(audio.audio.slice());
        sampleRate = audio.sampling_rate;
      }
      const samples = new Float32Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        samples.set(chunk, offset);
        offset += chunk.length;
      }
      scope.postMessage({ type: "audio", samples: samples.buffer, sampleRate }, [samples.buffer]);
    }
    await tts.model.dispose();
  } catch (error) {
    const quota = error instanceof DOMException && error.name === "QuotaExceededError";
    send({
      type: "error",
      message: quota
        ? "There is not enough space to save these voices. Free some storage and try again."
        : error instanceof TypeError
          ? "The voice download could not finish. Check your connection and try again. Device voices are still available."
          : error instanceof Error
            ? error.message
            : "This voice could not load. Please try again.",
    });
  }
};
