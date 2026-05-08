import { 
  TrendingUp, Layers, Camera, Crosshair, ArrowLeftRight, 
  ShieldCheck, Users, Download, Lock 
} from "lucide-react"
import Link from "next/link"
import { PwaInstallBanner } from "@/components/pwa-install-banner"
import { NavAuthButtons, HeroCTA } from "@/components/auth-buttons"

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "FinBoom",
  url: "https://finboom-cyan.vercel.app",
  description:
    "Free net worth tracker for Indian investors. Track stocks, mutual funds, real estate, gold, PPF, NPS, crypto and 22+ asset classes.",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "INR",
  },
  aggregateRating: undefined,
  creator: {
    "@type": "Organization",
    name: "FinBoom",
    url: "https://finboom-cyan.vercel.app",
  },
};

export default function Home() {

  const features = [
    { icon: TrendingUp, title: "Net Worth Tracking", desc: "See your complete financial picture at a glance with real-time calculations." },
    { icon: Layers, title: "22+ Asset Classes", desc: "Stocks, MFs, FDs, PPF, NPS, crypto, real estate, gold, EPF & more." },
    { icon: Camera, title: "Monthly Snapshots", desc: "Take snapshots to track your wealth growth over time with charts." },
    { icon: Crosshair, title: "Goal Planning", desc: "Set financial goals with inflation-adjusted targets and track progress." },
    { icon: ArrowLeftRight, title: "Income & Expenses", desc: "Track transactions with categories and see your savings rate." },
    { icon: ShieldCheck, title: "Health Check", desc: "Assess your insurance coverage and emergency fund adequacy." },
    { icon: Users, title: "Family Profiles", desc: "Track finances for family members and business separately." },
    { icon: Download, title: "Import Data", desc: "Import from Zerodha, Groww, or CSV/Excel files instantly." },
    { icon: Lock, title: "Private & Secure", desc: "Your data stays yours. No ads, no selling data. Ever." },
  ]

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="min-h-screen bg-white dark:bg-[#0a0a0a]">
      {/* Navbar */}
      <header>
      <nav className="sticky top-0 z-50 glass-elevated border-b border-black/[0.04] dark:border-white/[0.06]" aria-label="Main navigation">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10 h-12 flex items-center justify-between">
          <span className="text-[17px] font-semibold tracking-[-0.3px] text-[#1d1d1f] dark:text-white">FinBoom</span>
          <div className="flex items-center gap-2">
            <Link href="/blog" className="px-4 py-1.5 text-sm font-medium text-[#1d1d1f] dark:text-white rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">Blog</Link>
            <NavAuthButtons />
          </div>
        </div>
      </nav>
      </header>

      {/* Hero */}
      <section className="min-h-[calc(100vh-48px)] flex items-center justify-center">
        <div className="max-w-[980px] mx-auto px-6 text-center">
          <p className="text-[13px] font-medium text-[#515154] dark:text-[#98989d] uppercase tracking-[0.5px] mb-4">Free forever · Built for India</p>
          <h1 className="text-[56px] leading-[1.07] font-semibold tracking-[-0.5px] text-[#1d1d1f] dark:text-white">
            Know your true wealth.
          </h1>
          <p className="mt-4 text-[21px] leading-[1.38] font-normal text-[#3a3a3c] dark:text-[#aeaeb2] max-w-[600px] mx-auto">
            Track stocks, mutual funds, real estate, gold, and 22+ asset classes. One place for your entire net worth.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <HeroCTA />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gradient-to-br from-[#e8eaf0] via-[#f0eef5] to-[#eaf4f0] dark:from-[#111113] dark:via-[#131318] dark:to-[#111315] mesh-bg">
        <div className="max-w-[980px] mx-auto px-6">
          <h2 className="text-center text-[40px] leading-[1.1] font-semibold tracking-[-0.3px] text-[#1d1d1f] dark:text-white mb-4">
            Everything you need.
          </h2>
          <p className="text-center text-[17px] text-[#3a3a3c] dark:text-[#aeaeb2] mb-14">
            Complete personal finance toolkit for Indian investors.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="liquid-glass rounded-2xl p-7"
              >
                <div className="w-10 h-10 rounded-xl bg-white/60 dark:bg-white/10 flex items-center justify-center">
                  <feature.icon className="w-5 h-5 text-[#1d1d1f] dark:text-white" strokeWidth={1.5} />
                </div>
                <h3 className="mt-4 text-[17px] font-semibold text-[#1d1d1f] dark:text-white">{feature.title}</h3>
                <p className="mt-1 text-[14px] leading-[1.43] text-[#3a3a3c] dark:text-[#aeaeb2]">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-white dark:bg-[#0a0a0a]">
        <div className="max-w-[980px] mx-auto px-6">
          <h2 className="text-center text-[40px] leading-[1.1] font-semibold tracking-[-0.3px] text-[#1d1d1f] dark:text-white mb-14">
            Get started in seconds.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { step: "1", title: "Sign up free", desc: "Create your account in 10 seconds. No credit card needed." },
              { step: "2", title: "Add your assets", desc: "Add assets manually or import from Zerodha, Groww, or Excel." },
              { step: "3", title: "Track & grow", desc: "Monitor your net worth, set goals, and watch your wealth grow." },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-11 h-11 rounded-full bg-[#1d1d1f] dark:bg-white flex items-center justify-center mx-auto mb-4">
                  <span className="text-[17px] font-semibold text-white dark:text-[#0a0a0a]">{item.step}</span>
                </div>
                <h3 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">{item.title}</h3>
                <p className="mt-2 text-[14px] text-[#3a3a3c] dark:text-[#aeaeb2]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Asset Classes */}
      <section className="py-20 bg-[#f5f5f7] dark:bg-[#111113]">
        <div className="max-w-[980px] mx-auto px-6">
          <h2 className="text-center text-[40px] leading-[1.1] font-semibold tracking-[-0.3px] text-[#1d1d1f] dark:text-white mb-4">
            Track every asset class.
          </h2>
          <p className="text-center text-[17px] text-[#3a3a3c] dark:text-[#aeaeb2] mb-10">
            Indian markets, real estate, gold, crypto & more.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              "Stocks", "Mutual Funds", "Real Estate", "Gold",
              "Crypto", "Fixed Deposits", "PPF", "NPS",
              "EPF", "Bonds", "REITs", "Cash",
              "Collectibles", "Smallcase", "ULIP",
            ].map(item => (
              <span
                key={item}
                className="liquid-glass px-5 py-2 rounded-full text-[14px] text-[#1d1d1f] dark:text-white font-medium"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* PWA Install */}
      <PwaInstallBanner />

      {/* Blog */}
      <section className="py-20 bg-white dark:bg-[#0a0a0a]">
        <div className="max-w-[980px] mx-auto px-6 text-center">
          <h2 className="text-[40px] leading-[1.1] font-semibold tracking-[-0.3px] text-[#1d1d1f] dark:text-white mb-4">
            Learn & grow.
          </h2>
          <p className="mt-4 text-[17px] text-[#3a3a3c] dark:text-[#aeaeb2] max-w-[520px] mx-auto">
            Financial tips, market insights, and product updates to help you make smarter decisions with your money.
          </p>
          <div className="mt-8">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#f5f5f7] dark:bg-white/10 text-[15px] font-medium text-[#1d1d1f] dark:text-white hover:bg-[#e8e8ed] dark:hover:bg-white/15 transition-all"
            >
              Read the blog
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-gradient-to-br from-[#e8eaf0] via-[#f0eef5] to-[#eaf4f0] dark:from-[#111113] dark:via-[#131318] dark:to-[#111315]">
        <div className="max-w-[980px] mx-auto px-6 text-center">
          <h2 className="text-[40px] leading-[1.1] font-semibold tracking-[-0.3px] text-[#1d1d1f] dark:text-white">
            Start building wealth today.
          </h2>
          <p className="mt-4 text-[17px] text-[#3a3a3c] dark:text-[#aeaeb2] max-w-[500px] mx-auto">
            Join thousands of Indian investors who track their complete net worth with FinBoom.
          </p>
          <div className="mt-8">
            <HeroCTA />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#f5f5f7] dark:bg-[#111113] border-t border-black/[0.04] dark:border-white/[0.06] py-6">
        <div className="max-w-[980px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[14px] font-medium text-[#1d1d1f] dark:text-white">FinBoom</span>
          <p className="text-[12px] text-[#515154] dark:text-[#98989d]">
            © 2025 FinBoom. Free forever. Made in India.
          </p>
        </div>
      </footer>
    </div>
    </>
  );
}
