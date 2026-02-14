import type { Metadata } from "next";
import { Geist_Mono, Orbitron } from "next/font/google";
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
  description: "A sovereign refraction engine. Tuning the signal-to-noise ratio of a digital self.",
  icons: {
    icon: "/favicon.svg",
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
      </body>
    </html>
  );
}
