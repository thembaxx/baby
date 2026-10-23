export const VOICE_PACK_CACHE = "kora-voices-v1";
export const VOICE_PACK_MARKER = "/__kora/voice-pack-v1.json";
export const VOICE_VECTOR_CACHE = "kokoro-voices";
export const VOICE_RUNTIME_VERSION = process.env.NEXT_PUBLIC_VOICE_RUNTIME_VERSION;
export const VOICE_RUNTIME_BASE = `/voice-runtime/${VOICE_RUNTIME_VERSION}/`;
export const VOICE_RUNTIME_FILES = [
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
];
export const VOICE_MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
export const VOICE_REVISION = "1939ad2a8e416c0acfeecc08a694d14ef25f2231";
export const VOICE_MODEL_URL = `https://huggingface.co/${VOICE_MODEL}/resolve/${VOICE_REVISION}/onnx/model_quantized.onnx`;

export const FREE_VOICES = [
  { id: "af_heart", name: "Heart", description: "Warm · American English" },
  { id: "af_bella", name: "Bella", description: "Soft · American English" },
  {
    id: "am_michael",
    name: "Michael",
    description: "Clear · American English",
  },
  { id: "bf_emma", name: "Emma", description: "Gentle · British English" },
] as const;

export type FreeVoiceId = (typeof FREE_VOICES)[number]["id"];
export const isFreeVoice = (id: string): id is FreeVoiceId =>
  FREE_VOICES.some((voice) => voice.id === id);

export const voiceVectorUrl = (id: FreeVoiceId) =>
  `https://huggingface.co/${VOICE_MODEL}/resolve/main/voices/${id}.bin`;

export interface VoicePreferences {
  voice: string;
  rate: number;
}
export const DEFAULT_VOICE_PREFERENCES: VoicePreferences = {
  voice: "device:default",
  rate: 0.95,
};

export interface DeviceVoice {
  id: string;
  name: string;
  language: string;
  local: boolean;
}

export type VoiceWorkerRequest =
  | { type: "download" }
  | { type: "speak"; text: string; voice: FreeVoiceId; rate: number };
export type VoiceWorkerResponse =
  | { type: "progress"; progress: number }
  | { type: "ready" }
  | { type: "audio"; samples: ArrayBuffer; sampleRate: number }
  | { type: "error"; message: string };
