import { Newsreader, Instrument_Sans, JetBrains_Mono } from "next/font/google";

export const serif = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
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
