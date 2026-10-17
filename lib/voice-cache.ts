import {
  FREE_VOICES,
  VOICE_PACK_CACHE,
  VOICE_PACK_MARKER,
  VOICE_VECTOR_CACHE,
  VOICE_MODEL_URL,
  VOICE_RUNTIME_VERSION,
  VOICE_RUNTIME_BASE,
  VOICE_RUNTIME_FILES,
  voiceVectorUrl,
} from "./voice-options";

export async function hasVoicePack() {
  if (typeof caches === "undefined") return false;
  if (!(await caches.has(VOICE_PACK_CACHE))) return false;
  const cache = await caches.open(VOICE_PACK_CACHE);
  const marker = await cache.match(VOICE_PACK_MARKER);
  if (!marker || !(await cache.match(VOICE_MODEL_URL))) return false;
  const metadata = await marker.json().catch(() => null);
  if (metadata?.runtimeVersion !== VOICE_RUNTIME_VERSION) return false;
  const runtime = await Promise.all(
    VOICE_RUNTIME_FILES.map((file) =>
      cache.match(`${VOICE_RUNTIME_BASE}${file}`),
    ),
  );
  if (!runtime.every(Boolean)) return false;
  if (!(await caches.has(VOICE_VECTOR_CACHE))) return false;
  const vectors = await caches.open(VOICE_VECTOR_CACHE);
  const files = await Promise.all(
    FREE_VOICES.map((voice) => vectors.match(voiceVectorUrl(voice.id))),
  );
  return files.every(Boolean);
}

export async function hasSavedVoiceFiles() {
  if (typeof caches === "undefined" || !(await caches.has(VOICE_PACK_CACHE)))
    return false;
  return (await (await caches.open(VOICE_PACK_CACHE)).keys()).length > 0;
}

export async function removeVoicePack() {
  if (typeof caches === "undefined") return;
  await caches.delete(VOICE_PACK_CACHE);
  if (!(await caches.has(VOICE_VECTOR_CACHE))) return;
  const vectors = await caches.open(VOICE_VECTOR_CACHE);
  await Promise.all(
    FREE_VOICES.map((voice) => vectors.delete(voiceVectorUrl(voice.id))),
  );
  if (!(await vectors.keys()).length) await caches.delete(VOICE_VECTOR_CACHE);
}
