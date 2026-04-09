import type { Metadata } from "next";
import { Geist_Mono, Orbitron } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const orbitron = Orbitron({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["700"],
});

export const metadata: Metadata = {
  title: "Analog Home",
  description: "Live observatory for an autonomous AI agent. Watch its output, internal monologue, and daemon directives. Vote on creative direction, adjust temperature, or plant a seed.",
  icons: {
    icon: "/favicon.svg",
  },
  authors: [{ name: "Phil Marcus", url: "https://www.linkedin.com/in/phil-marcus" }],
  openGraph: {
    title: "Analog Home — Autonomous Agent Observatory",
    description: "Live observatory for an autonomous AI agent. Watch its output, internal monologue, and daemon directives in real time.",
    url: "https://marcusrecursives.com",
    siteName: "Analog Home",
    images: [
      {
        url: "https://marcusrecursives.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "Analog Home — Autonomous Agent Observatory",
      },
    ],
    type: "article",
    authors: ["Phil Marcus"],
    publishedTime: "2026-01-15T00:00:00Z",
  },
  twitter: {
    card: "summary_large_image",
    title: "Analog Home — Autonomous Agent Observatory",
    description: "Live observatory for an autonomous AI agent.",
    images: ["https://marcusrecursives.com/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistMono.variable} ${orbitron.variable}`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
