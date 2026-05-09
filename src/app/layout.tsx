import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4, JetBrains_Mono, Playfair_Display } from "next/font/google";
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

const playfair = Playfair_Display({
  variable: "--font-display",
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
    statusBarStyle: "default",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e8eaf0" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${sourceSerif.variable} ${jetbrainsMono.variable} ${playfair.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>

      </head>
      <body className="min-h-full flex flex-col">
        <Script id="theme-init" strategy="beforeInteractive">{`
          (function() {
            var t = localStorage.getItem('theme');
            if (t === 'dark') document.documentElement.classList.add('dark');
            else if (t === 'system') {
              if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('dark');
            }
            function updateTheme() {
              var isDark = document.documentElement.classList.contains('dark');
              var href = isDark ? '/icons/favicon-dark.svg' : '/icons/favicon-light.svg';
              var link = document.querySelector('link[data-favicon]');
              if (!link) { link = document.createElement('link'); link.rel = 'icon'; link.type = 'image/svg+xml'; link.setAttribute('data-favicon',''); document.head.appendChild(link); }
              link.href = href;
              var metas = document.querySelectorAll('meta[name="theme-color"]');
              var color = isDark ? '#131315' : '#f3f2f5';
              if (metas.length) { metas.forEach(function(m) { m.setAttribute('content', color); }); }
              else { var m = document.createElement('meta'); m.name = 'theme-color'; m.content = color; document.head.appendChild(m); }
            }
            updateTheme();
            new MutationObserver(function() { updateTheme(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
          })();
        `}</Script>
        <Script id="no-scroll-number" strategy="afterInteractive">{`
          document.addEventListener('wheel', function(e) {
            if (document.activeElement && document.activeElement.type === 'number') {
              document.activeElement.blur();
            }
          }, { passive: true });
        `}</Script>
        <ClerkProvider>
          {children}
          <PwaInstallPopup />
        </ClerkProvider>
      </body>
    </html>
  );
}
