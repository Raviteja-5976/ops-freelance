import { Newsreader, Instrument_Sans, JetBrains_Mono } from "next/font/google";

// next/font ships no fallback metrics for Newsreader, so the automatic
// fallback adjustment logs "Failed to find font override values". Fall back
// to Georgia directly instead.
export const serif = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
  adjustFontFallback: false,
  fallback: ["Georgia", "serif"],
});

export const sans = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});
