import type { Metadata } from "next";
import { serif, sans, mono } from "./fonts";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { DataProvider } from "@/components/providers/DataProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenRiverStack — Client Portal",
  description: "Private client workspace and admin portal for OpenRiverStack Studio.",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${serif.variable} ${sans.variable} ${mono.variable}`}
    >
      <body className="min-h-screen bg-paper text-ink-950 font-sans antialiased selection:bg-river-100 selection:text-river-950">
        <ToastProvider>
          <AuthProvider>
            <DataProvider>{children}</DataProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
