import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, DM_Sans, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0c0a09" },
    { media: "(prefers-color-scheme: light)", color: "#f5f2eb" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Nocturne Cry — Infant Cry Decoder & Nursery Companion",
  description:
    "Privacy-first infant cry audio analyzer powered by local Ollama (qwen2-audio) and the Vercel AI SDK, paired with a 3:00 AM low-glare nursery care tracker and soothing soundscape synthesizer.",
  applicationName: "Kora",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kora",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Nocturne Cry — Infant Cry Decoder & Nursery Companion",
    description:
      "Privacy-first infant cry audio analyzer powered by local Ollama (qwen2-audio) and the Vercel AI SDK, paired with a 3:00 AM low-glare nursery care tracker and soothing soundscape synthesizer.",
    siteName: "Kora Nursery Studio",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nocturne Cry — Infant Cry Decoder & Nursery Companion",
    description:
      "Privacy-first infant cry audio analyzer powered by local Ollama (qwen2-audio) and the Vercel AI SDK, paired with a 3:00 AM low-glare nursery care tracker and soothing soundscape synthesizer.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Kora (Nocturne Cry) — 3D Infant Cry Studio & Nursery Companion",
    applicationCategory: "HealthApplication",
    operatingSystem: "All",
    description:
      "Privacy-first 3D infant cry audio analyzer powered by local Ollama (qwen2-audio), Vercel AI SDK, Three.js WebGL acoustic totems, voice control, and offline LLM weights.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <html
      lang="en"
      data-theme="nocturne"
      className={`${plusJakarta.variable} ${dmSans.variable} ${jetbrainsMono.variable} dark`}
      suppressHydrationWarning
    >
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-dvh antialiased selection:bg-amber-400/20 selection:text-amber-200"
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
