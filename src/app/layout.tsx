import "./globals.css";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Orbitron, JetBrains_Mono } from "next/font/google";
import VideoBackground from "@/components/VideoBackground";
import GlobalHeader from "@/components/GlobalHeader";
import GlobalFooter from "@/components/GlobalFooter";
import SSOClientHandler from "@/components/SSOClientHandler";
import { Suspense } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bedasoft IA - Neural Engine",
  description: "Quantum Intelligence Operating System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${orbitron.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-black overflow-x-hidden">
        <Suspense fallback={null}>
          <SSOClientHandler />
        </Suspense>
        {/* El vídeo vive aquí ahora, persistente entre cambios de página */}
        <VideoBackground />
        
        {/* Interfaz Global HUD */}
        <GlobalHeader />
        
        {/* El contenido de la app flota encima */}
        <div className="relative z-10 flex-1 flex flex-col">
          {children}
        </div>

        <GlobalFooter />
      </body>
    </html>
  );
}
