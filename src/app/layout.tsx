import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";
import { PwaInstallPopup } from "@/components/pwa-install-popup";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://finboom-cyan.vercel.app"),
  title: {
    default: "FinBoom - Know Your True Wealth | Net Worth Tracker for India",
    template: "%s | FinBoom",
  },
  description: "Free net worth tracker for Indian investors. Track stocks, mutual funds, real estate, gold, PPF, NPS, crypto and 22+ asset classes. Set financial goals, monitor expenses, and grow your wealth.",
  keywords: [
    "net worth tracker",
    "personal finance India",
    "wealth tracker",
    "portfolio tracker India",
    "mutual fund tracker",
    "stock portfolio tracker",
    "financial goal planner",
    "expense tracker India",
    "asset tracker",
    "PPF NPS EPF tracker",
    "Indian investor tools",
    "finboom",
  ],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FinBoom",
  },
  alternates: {
    canonical: "https://finboom-cyan.vercel.app",
  },
  openGraph: {
    title: "FinBoom - Know Your True Wealth | Free Net Worth Tracker",
    description: "Track stocks, mutual funds, real estate, gold, and 22+ asset classes. Free forever. Built for Indian investors.",
    url: "https://finboom-cyan.vercel.app",
    siteName: "FinBoom",
    locale: "en_IN",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "FinBoom - Know Your True Wealth",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FinBoom - Know Your True Wealth",
    description: "Track stocks, mutual funds, real estate, gold, and 22+ asset classes. Free forever. Built for Indian investors.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#1d1d1f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${sourceSerif.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
      </head>
      <body className="min-h-full flex flex-col">
        <Script id="theme-init" strategy="beforeInteractive">{`
          (function() {
            var t = localStorage.getItem('theme');
            if (t === 'dark') document.documentElement.classList.add('dark');
            else if (t === 'system') {
              if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('dark');
            }
          })();
        `}</Script>
        <ClerkProvider>
          {children}
          <PwaInstallPopup />
        </ClerkProvider>
      </body>
    </html>
  );
}
