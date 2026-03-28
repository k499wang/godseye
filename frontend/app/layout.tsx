import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "GodSEye — Prediction Market Simulator",
  description: "Multi-agent prediction market analysis and simulation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${ibmPlexMono.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
          <Providers>{children}</Providers>
        </body>
    </html>
  );
}
