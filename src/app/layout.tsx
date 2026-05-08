import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://finboom.in"),
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
    canonical: "https://finboom.in",
  },
  openGraph: {
    title: "FinBoom - Know Your True Wealth | Free Net Worth Tracker",
    description: "Track stocks, mutual funds, real estate, gold, and 22+ asset classes. Free forever. Built for Indian investors.",
    url: "https://finboom.in",
    siteName: "FinBoom",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FinBoom - Know Your True Wealth",
    description: "Track stocks, mutual funds, real estate, gold, and 22+ asset classes. Free forever. Built for Indian investors.",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var t = localStorage.getItem('theme');
            if (t === 'dark') document.documentElement.classList.add('dark');
            else if (t === 'system') {
              if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('dark');
            }
          })();
        `}} />
      </head>
      <body className="min-h-full flex flex-col">
        <ClerkProvider
          appearance={{
            variables: {
              colorPrimary: "#1d1d1f",
              colorBackground: "#1c1c1e",
              colorText: "#ffffff",
              colorTextSecondary: "#98989d",
              colorInputBackground: "#2c2c2e",
              colorInputText: "#ffffff",
              borderRadius: "0.75rem",
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            },
            elements: {
              card: "bg-[#1c1c1e] border border-white/[0.06] shadow-2xl",
              headerTitle: "text-white",
              headerSubtitle: "text-[#98989d]",
              socialButtonsBlockButton:
                "bg-[#2c2c2e] border-white/[0.06] text-white hover:bg-[#3a3a3c]",
              formButtonPrimary:
                "bg-[#1d1d1f] hover:bg-[#2c2c2e] text-white border border-white/10",
              formFieldInput:
                "bg-[#2c2c2e] border-white/[0.06] text-white placeholder:text-[#636366]",
              formFieldLabel: "text-white",
              footerActionLink: "text-[#34c759] hover:text-[#30d158]",
              identityPreview: "bg-[#2c2c2e] border-white/[0.06]",
              identityPreviewText: "text-white",
              identityPreviewEditButton: "text-[#34c759]",
              dividerLine: "bg-white/[0.06]",
              dividerText: "text-[#636366]",
              footer: "hidden",
            },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
