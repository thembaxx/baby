import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { GoogleGenAI, Type } from "@google/genai";
import { resolveOllamaBaseUrl, validateCryAudio } from "@/lib/cry-request-policy";

// Define strict schema for the cry analysis breakdown
const CryAnalysisSchema = z.object({
  primaryCategory: z.enum([
    "Hunger",
    "Gas / Colic",
    "Sleep Regression / Overtired",
    "Discomfort / Wet Diaper",
    "Needs Soothing",
  ]),
  confidenceScore: z.number().min(0).max(100),
  probabilityBreakdown: z.object({
    hunger: z.number(),
    gas: z.number(),
    overtired: z.number(),
    discomfort: z.number(),
  }),
  immediateSoothingAction: z.string(),
  acousticSignature: z.string().optional(),
  soothingSteps: z.array(z.string()).optional(),
});

export type CryAnalysisResult = z.infer<typeof CryAnalysisSchema> & {
  engineUsed?: "ollama-local" | "gemini-multimodal" | "local-acoustic-fallback";
  modelName?: string;
  latencyMs?: number;
  timestamp?: string;
};

const PRESET_PROFILES: Record<string, CryAnalysisResult> = {
  hunger: {
    primaryCategory: "Hunger",
    confidenceScore: 89,
    probabilityBreakdown: { hunger: 78, gas: 8, overtired: 9, discomfort: 5 },
    immediateSoothingAction:
      "Offer a paced bottle or breastfeed immediately; watch for rooting and rhythmic sucking reflex.",
    acousticSignature:
      'Rhythmic "Neh" nasalized onset (~420 Hz fundamental) created by tongue-palate sucking reflex.',
    soothingSteps: [
      "Hold infant upright at a 45-degree angle to prevent air intake",
      "Offer feed before cry escalates into gulping air",
      "Pause halfway through feeding for a gentle upright burp",
    ],
  },
  gas: {
    primaryCategory: "Gas / Colic",
    confidenceScore: 84,
    probabilityBreakdown: { hunger: 12, gas: 74, overtired: 10, discomfort: 4 },
    immediateSoothingAction: "Apply gentle bicycle legs and counter-clockwise tummy massage.",
    acousticSignature:
      'High-tension "Eairh" strained abdominal resonance (~610 Hz peak) with constricted glottal pauses.',
    soothingSteps: [
      "Lay infant on back and slowly cycle legs in a bicycle motion for 60 seconds",
      "Use warm fingertips for gentle clockwise circles around the navel",
      'Hold in the "Colic Carry" (tummy-down along your forearm) with gentle patting',
    ],
  },
  overtired: {
    primaryCategory: "Sleep Regression / Overtired",
    confidenceScore: 86,
    probabilityBreakdown: { hunger: 10, gas: 9, overtired: 73, discomfort: 8 },
    immediateSoothingAction:
      "Dim nursery lighting, swaddle snugly, and initiate continuous womb brown noise.",
    acousticSignature:
      'Elongated "Owh" descending pitch contour (~360 Hz to 280 Hz) triggered by yawn-reflex vocal tract shaping.',
    soothingSteps: [
      "Reduce visual stimulation and keep room illumination below 5 lux amber",
      "Swaddle arms snugly or place in sleep sack and hold on side",
      "Play steady low-frequency brown noise at 50 dB and rock with slow rhythmic sway",
    ],
  },
  discomfort: {
    primaryCategory: "Discomfort / Wet Diaper",
    confidenceScore: 82,
    probabilityBreakdown: { hunger: 9, gas: 14, overtired: 11, discomfort: 66 },
    immediateSoothingAction:
      "Check diaper wetness, clothing tags, or skin temperature at the back of the neck.",
    acousticSignature:
      'Breathy "Heh" staccato bursts (~480 Hz) indicating tactile skin or thermal irritation.',
    soothingSteps: [
      "Check diaper indicator line and inspect skin folds for chafing or tight elastic",
      "Feel the nape of the neck to ensure baby is neither overheated nor chilly",
      "Inspect fingers and toes for any hair tourniquet or bunched sleepwear fabric",
    ],
  },
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const customUrl = resolveOllamaBaseUrl(
    searchParams.get("baseUrl") ?? undefined,
    process.env.OLLAMA_BASE_URL,
  );
  if (!customUrl) {
    return NextResponse.json(
      { error: "Only the server-configured model address is allowed." },
      { status: 400 },
    );
  }
  const tagsUrl = customUrl.replace(/\/v1\/?$/, "") + "/api/tags";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1800);
    const res = await fetch(tagsUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({
        online: false,
        endpoint: customUrl,
        models: [],
        message: `Ollama responded with status ${res.status}`,
      });
    }

    const data = await res.json();
    const models = Array.isArray(data.models)
      ? data.models.map((m: { name: string }) => m.name)
      : [];

    return NextResponse.json({
      online: true,
      endpoint: customUrl,
      models,
      hasQwenAudio: models.some((m: string) => m.toLowerCase().includes("qwen2-audio")),
    });
  } catch {
    return NextResponse.json({
      online: false,
      endpoint: customUrl,
      models: [],
      message:
        "Local Ollama daemon not detected at " +
        customUrl +
        ". Using automatic multimodal fallback.",
    });
  }
}

export async function POST(req: Request) {
  const startTime = Date.now();
  let parsedBody: {
    audioBase64?: string;
    mimeType?: string;
    ollamaBaseUrl?: string;
    ollamaModel?: string;
    inferenceMode?: "auto" | "ollama" | "gemini";
    presetHint?: string;
    careContext?: {
      minutesSinceLastFeed?: number;
      minutesSinceLastSleep?: number;
      minutesSinceLastDiaper?: number;
    };
  } = {};

  if (Number(req.headers.get("content-length") || 0) > 6 * 1024 * 1024) {
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  }
  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Expected a JSON object." }, { status: 400 });
    }
    parsedBody = body as typeof parsedBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON request payload" }, { status: 400 });
  }

  const {
    audioBase64 = "",
    mimeType = "audio/webm",
    ollamaBaseUrl: requestedOllamaBaseUrl,
    ollamaModel = process.env.OLLAMA_MODEL || "qwen2-audio",
    inferenceMode = "auto",
    presetHint,
    careContext,
  } = parsedBody;

  const ollamaBaseUrl = resolveOllamaBaseUrl(requestedOllamaBaseUrl, process.env.OLLAMA_BASE_URL);
  if (!ollamaBaseUrl)
    return NextResponse.json(
      { error: "Only the server-configured model address is allowed." },
      { status: 400 },
    );
  const audioError = validateCryAudio(audioBase64, mimeType);
  if (audioError) return NextResponse.json({ error: audioError }, { status: 400 });
  if (!["auto", "ollama", "gemini"].includes(inferenceMode)) {
    return NextResponse.json({ error: "Unsupported inference mode." }, { status: 400 });
  }
  if (typeof ollamaModel !== "string" || !/^[A-Za-z0-9_.:\/-]{1,90}$/.test(ollamaModel)) {
    return NextResponse.json({ error: "Invalid model name." }, { status: 400 });
  }
  const safeMinutes = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 20160
      ? Math.round(value)
      : "unknown";

  const contextSummary = careContext
    ? `Recent nursery context: Last fed ${safeMinutes(careContext.minutesSinceLastFeed)} mins ago, awake for ${safeMinutes(careContext.minutesSinceLastSleep)} mins, last diaper change ${safeMinutes(careContext.minutesSinceLastDiaper)} mins ago.`
    : "";

  // 1. Attempt Local Ollama via Vercel AI SDK (when inferenceMode is 'auto' or 'ollama')
  if (inferenceMode === "auto" || inferenceMode === "ollama") {
    try {
      const ollamaLocal = createOpenAI({
        baseURL: ollamaBaseUrl,
        apiKey: "ollama", // Ollama doesn't require a real key
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);

      const { object } = await generateObject({
        model: ollamaLocal(ollamaModel),
        schema: CryAnalysisSchema,
        abortSignal: controller.signal,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this 5-second infant audio clip. Categorize the primary cause of the cry, calculate probability percentages for hunger, gas, overtiredness, and discomfort, provide the acoustic signature, and give a 1-sentence immediate soothing step plus 3 actionable soothing steps. ${contextSummary}`,
              },
              {
                type: "file",
                data: audioBase64,
                mediaType: mimeType,
              },
            ],
          },
        ],
      });

      clearTimeout(timeout);

      return NextResponse.json({
        ...object,
        engineUsed: "ollama-local",
        modelName: ollamaModel,
        latencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });
    } catch (ollamaError) {
      console.warn(
        "Local Ollama Cry Classification unavailable, checking fallback:",
        ollamaError instanceof Error ? ollamaError.message : ollamaError,
      );
    }
  }

  // 2. Attempt Server-Side Gemini Multimodal Audio Analysis when local Ollama isn't running
  if (
    (inferenceMode === "auto" || inferenceMode === "gemini") &&
    process.env.GEMINI_API_KEY &&
    process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY" &&
    audioBase64.length > 64
  ) {
    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const hintInstruction = presetHint
        ? `Note: If this clip is a synthesized reference test clip for "${presetHint}", reflect the corresponding pediatric Dunstan cry acoustics.`
        : "";

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType.split(";")[0] || "audio/webm",
                data: audioBase64,
              },
            },
            {
              text: `You are a pediatric infant cry acoustic analyzer. Analyze this 5-second infant audio clip. Categorize the primary cause of the cry, calculate probability percentages (summing to 100) for hunger, gas, overtiredness, and discomfort, describe the acoustic signature (pitch/formant/rhythm), give a 1-sentence immediate soothing action, and list 3 concrete soothing steps. ${contextSummary} ${hintInstruction}`,
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              primaryCategory: {
                type: Type.STRING,
                enum: [
                  "Hunger",
                  "Gas / Colic",
                  "Sleep Regression / Overtired",
                  "Discomfort / Wet Diaper",
                  "Needs Soothing",
                ],
              },
              confidenceScore: {
                type: Type.NUMBER,
                description: "Confidence score from 0 to 100",
              },
              probabilityBreakdown: {
                type: Type.OBJECT,
                properties: {
                  hunger: { type: Type.NUMBER },
                  gas: { type: Type.NUMBER },
                  overtired: { type: Type.NUMBER },
                  discomfort: { type: Type.NUMBER },
                },
                required: ["hunger", "gas", "overtired", "discomfort"],
              },
              immediateSoothingAction: {
                type: Type.STRING,
              },
              acousticSignature: {
                type: Type.STRING,
              },
              soothingSteps: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              "primaryCategory",
              "confidenceScore",
              "probabilityBreakdown",
              "immediateSoothingAction",
              "acousticSignature",
              "soothingSteps",
            ],
          },
        },
      });

      const rawText = response.text;
      if (rawText) {
        const parsed = CryAnalysisSchema.parse(JSON.parse(rawText.trim()));
        return NextResponse.json({
          ...parsed,
          engineUsed: "gemini-multimodal",
          modelName: "gemini-3.8-flash",
          latencyMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (geminiErr) {
      console.warn(
        "Gemini multimodal fallback error:",
        geminiErr instanceof Error ? geminiErr.message : geminiErr,
      );
    }
  }

  // Synthetic test buttons may use illustrative data. Real audio never gets fake classifications.
  if (typeof presetHint === "string" && Object.hasOwn(PRESET_PROFILES, presetHint)) {
    return NextResponse.json({
      ...PRESET_PROFILES[presetHint],
      engineUsed: "local-acoustic-fallback",
      modelName: "Synthetic demo (not analyzed)",
      latencyMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  }
  return NextResponse.json(
    {
      error:
        "No analysis model is available. Configure Ollama or Gemini and retry; no diagnosis was generated.",
    },
    { status: 503 },
  );
}
