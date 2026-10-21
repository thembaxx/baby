// Pure request guards shared by the API route and unit tests.
export const MAX_AUDIO_BASE64_LENGTH = 4 * 1024 * 1024;
const AUDIO_TYPES = new Set(['audio/webm', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/mpeg', 'audio/aac']);
export function resolveOllamaBaseUrl(requested: unknown, configured: string | undefined): string | null {
  // Public requests cannot choose an arbitrary server-side fetch target (SSRF).
  const trusted = (configured || 'http://localhost:11434/v1').trim().replace(/\/$/, '');
  if (requested !== undefined && (typeof requested !== 'string' || requested.trim().replace(/\/$/, '') !== trusted)) return null;
  return trusted;
}
export function validateCryAudio(audio: unknown, mime: unknown): string | null {
  if (typeof audio !== 'string' || audio.length < 64 || audio.length > MAX_AUDIO_BASE64_LENGTH) return 'Audio missing or too large (maximum approximately 3 MiB).';
  if (audio.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(audio)) return 'Audio must be base64 encoded.';
  if (typeof mime !== 'string' || !AUDIO_TYPES.has(mime.split(';')[0].trim().toLowerCase())) return 'Unsupported audio format.';
  return null;
}
