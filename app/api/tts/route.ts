import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: Request) {
  try {
    const { text, voiceName = "Kore" } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing text for speech synthesis" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY") {
      return NextResponse.json(
        { fallbackToBrowserSpeech: true, reason: "No server API key configured" },
        { status: 200 },
      );
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash-lite-tts",
      contents: [
        {
          role: "user",
          parts: [
            {
              text,
            },
          ],
        },
      ],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      return NextResponse.json({ fallbackToBrowserSpeech: true }, { status: 200 });
    }

    return NextResponse.json({
      audioBase64: base64Audio,
      mimeType: "audio/wav",
      modelUsed: "gemini-3.8-flash-lite-tts",
    });
  } catch (err) {
    console.warn(
      "Server TTS fallback to browser speechSynthesis:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ fallbackToBrowserSpeech: true }, { status: 200 });
  }
}
