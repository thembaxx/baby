import {
  FREE_VOICES,
  VOICE_PACK_CACHE,
  VOICE_PACK_MARKER,
  VOICE_VECTOR_CACHE,
  VOICE_MODEL_URL,
  voiceVectorUrl,
} from "./voice-options";

export async function hasVoicePack() {
  if (typeof caches === "undefined") return false;
  if (!(await caches.has(VOICE_PACK_CACHE))) return false;
  const cache = await caches.open(VOICE_PACK_CACHE);
  if (
    !(await cache.match(VOICE_PACK_MARKER)) ||
    !(await cache.match(VOICE_MODEL_URL))
  )
    return false;
  if (!(await caches.has(VOICE_VECTOR_CACHE))) return false;
  const vectors = await caches.open(VOICE_VECTOR_CACHE);
  const files = await Promise.all(
    FREE_VOICES.map((voice) => vectors.match(voiceVectorUrl(voice.id))),
  );
  return files.every(Boolean);
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
