import type { Metadata } from "next";
import { Instrument_Serif, Inter, Syne } from "next/font/google";
import "./globals.css";
import { ScrollProgressBar } from "@/components/scroll-progress-bar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "SKU — fashion discovery",
  description: "Brand portfolio, inspo, and conversational shopping tailored to your style.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${syne.variable} ${instrumentSerif.variable} font-sans antialiased`}
      >
        <ScrollProgressBar />
        <div className="sku-mesh-backdrop" aria-hidden />
        <div className="sku-mesh-vignette" aria-hidden />
        <div className="sku-app-shell">
          <div className="relative z-10 min-h-[100dvh]">{children}</div>
        </div>
      </body>
    </html>
  );
}
