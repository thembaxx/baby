import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Kora — 3D Infant Cry Studio & Tactile Nursery Companion",
    short_name: "Kora",
    description:
      "Privacy-first 3D infant cry acoustic analyzer powered by local Ollama, Vercel AI SDK, WebGL Three.js resonance totems, voice control, and offline LLM weights.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0c0a09",
    theme_color: "#0c0a09",
    categories: ["medical", "health", "lifestyle", "utilities"],
    icons: [
      {
        src: "/pwa-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
