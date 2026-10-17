import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['600', '700'],
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'Nocturne Cry — Infant Cry Decoder & Nursery Companion',
  description:
    'Privacy-first infant cry audio analyzer powered by local Ollama (qwen2-audio) and the Vercel AI SDK, paired with a 3:00 AM low-glare nursery care tracker and soothing soundscape synthesizer.',
  openGraph: {
    title: 'Nocturne Cry — Infant Cry Decoder & Nursery Companion',
    description:
      'Privacy-first infant cry audio analyzer powered by local Ollama (qwen2-audio) and the Vercel AI SDK, paired with a 3:00 AM low-glare nursery care tracker and soothing soundscape synthesizer.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nocturne Cry — Infant Cry Decoder & Nursery Companion',
    description:
      'Privacy-first infant cry audio analyzer powered by local Ollama (qwen2-audio) and the Vercel AI SDK, paired with a 3:00 AM low-glare nursery care tracker and soothing soundscape synthesizer.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${dmSans.variable} ${jetbrainsMono.variable} dark`}
    >
      <body
        suppressHydrationWarning
        className="bg-stone-950 text-stone-100 font-sans antialiased selection:bg-amber-400/20 selection:text-amber-200 min-h-screen"
      >
        {children}
      </body>
    </html>
  );
}
