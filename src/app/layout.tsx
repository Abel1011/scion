import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Space_Mono } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-grotesk",
});

const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono-scion",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://scion-db.vercel.app"),
  title: {
    default: "Scion — Preview Databases",
    template: "%s · Scion",
  },
  description:
    "Instant, isolated, PII-masked Aurora database branches for every Vercel preview.",
  openGraph: {
    title: "Scion — Preview Databases",
    description:
      "Instant, isolated, PII-masked Aurora database branches for every Vercel preview.",
    url: "/",
    siteName: "Scion",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#2c7a37",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${grotesk.variable} ${mono.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
