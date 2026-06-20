// Registry for the public /tools calculators. Single source of truth used by
// the landing grid, per-tool metadata, sitemap, and the calculator router.

export interface ToolFaq {
  q: string
  a: string
}

export interface ToolDef {
  slug: string
  title: string
  tagline: string
  description: string
  keywords: string[]
  gradient: string
  icon: string
  intro: string
  faqs: ToolFaq[]
}

export const TOOLS: readonly ToolDef[] = [
  {
    slug: "sip",
    title: "SIP Calculator",
    tagline: "Project the future value of a monthly SIP",
    description:
      "Free SIP calculator for mutual funds. Estimate the future value, total invested, and wealth gained from a monthly SIP at any expected return and tenure.",
    keywords: ["sip calculator", "mutual fund sip", "sip returns", "monthly investment calculator"],
    gradient: "from-emerald-500/25 via-teal-400/10 to-transparent",
    icon: "📈",
    intro:
      "A Systematic Investment Plan (SIP) lets you invest a fixed amount every month. Compounding does the heavy lifting — small, regular investments can grow into a large corpus over time. Enter your monthly amount, expected return, and how long you'll invest.",
    faqs: [
      {
        q: "How is SIP return calculated?",
        a: "Each monthly instalment compounds at the expected rate for the months remaining until the end of the tenure. We use the standard start-of-month SIP formula that AMCs use, so your earliest instalments earn the most.",
      },
      {
        q: "What return should I assume?",
        a: "Equity mutual funds in India have historically delivered roughly 10–12% annualised over long periods, debt funds 6–8%. Returns are not guaranteed — use a conservative figure and review periodically.",
      },
    ],
  },
  {
    slug: "step-up-sip",
    title: "Step-Up SIP Calculator",
    tagline: "Increase your SIP every year as income grows",
    description:
      "Step-up SIP calculator: see how raising your monthly SIP by a fixed percentage each year dramatically increases your final corpus versus a flat SIP.",
    keywords: ["step up sip calculator", "top up sip", "annual increase sip", "sip growth calculator"],
    gradient: "from-sky-500/25 via-indigo-400/10 to-transparent",
    icon: "🚀",
    intro:
      "A step-up (or top-up) SIP raises your monthly contribution by a set percentage every year — usually in line with your salary growth. Even a 10% annual step-up can grow your final corpus far beyond a flat SIP.",
    faqs: [
      {
        q: "Why use a step-up SIP?",
        a: "Your income usually rises every year, so a fixed SIP becomes a smaller share of your earnings over time. Stepping it up keeps your savings rate intact and compounds the extra amounts for years.",
      },
      {
        q: "What step-up percentage is reasonable?",
        a: "Many investors pick 5–10% to match expected salary hikes. The calculator lets you try any value and compare the impact instantly.",
      },
    ],
  },
  {
    slug: "lumpsum",
    title: "Lumpsum Calculator",
    tagline: "Grow a one-time investment over time",
    description:
      "Lumpsum investment calculator. Find the future value of a one-time investment compounded annually at your expected rate of return.",
    keywords: ["lumpsum calculator", "one time investment", "compound interest calculator", "future value"],
    gradient: "from-violet-500/25 via-purple-400/10 to-transparent",
    icon: "💰",
    intro:
      "A lumpsum investment puts a single amount to work today. Thanks to compounding, the longer you stay invested, the more your money grows. Enter the amount, expected return, and tenure.",
    faqs: [
      {
        q: "Lumpsum or SIP — which is better?",
        a: "Lumpsum works best when you have a large amount ready and markets are reasonably valued; SIP averages your cost over time and suits regular savers. Many investors do both.",
      },
      {
        q: "How does compounding work here?",
        a: "Returns are reinvested each year, so you earn returns on your returns. The future value is principal × (1 + rate) raised to the number of years.",
      },
    ],
  },
  {
    slug: "fd",
    title: "FD Calculator",
    tagline: "Maturity value of a fixed deposit",
    description:
      "Fixed deposit (FD) calculator. Compute maturity amount and interest earned for any principal, rate, tenure, and compounding frequency.",
    keywords: ["fd calculator", "fixed deposit calculator", "fd maturity", "fd interest calculator"],
    gradient: "from-amber-500/25 via-orange-400/10 to-transparent",
    icon: "🏦",
    intro:
      "A fixed deposit pays a guaranteed interest rate for a chosen tenure. Indian banks usually compound interest quarterly. Enter your deposit, rate, tenure, and compounding frequency to see the maturity amount.",
    faqs: [
      {
        q: "How often is FD interest compounded?",
        a: "Most Indian banks compound FD interest quarterly. Some offer monthly or annual compounding — pick the right option to match your bank's terms.",
      },
      {
        q: "Is FD interest taxable?",
        a: "Yes. FD interest is added to your income and taxed at your slab rate. Banks deduct TDS if interest crosses the threshold. This calculator shows pre-tax maturity.",
      },
    ],
  },
  {
    slug: "xirr",
    title: "XIRR Calculator",
    tagline: "True annualised return for irregular cash flows",
    description:
      "XIRR calculator for investments with multiple dated cash flows. Get the true annualised return across SIPs, lumpsums, and redemptions.",
    keywords: ["xirr calculator", "xirr returns", "mutual fund xirr", "annualised return calculator"],
    gradient: "from-rose-500/25 via-pink-400/10 to-transparent",
    icon: "🧮",
    intro:
      "XIRR is the annualised return when money goes in and out on different dates — the right metric for SIPs, lumpsums, and partial redemptions. Add each cash flow (investments negative, redemptions and current value positive) to compute it.",
    faqs: [
      {
        q: "What's the difference between XIRR and absolute return?",
        a: "Absolute return ignores timing. XIRR accounts for when each rupee was invested or withdrawn, giving the true time-weighted annualised return — essential for SIPs.",
      },
      {
        q: "How do I enter my cash flows?",
        a: "Enter every investment as a negative amount on its date, and your current portfolio value (or redemptions) as a positive amount on today's date. You need at least one negative and one positive entry.",
      },
    ],
  },
  {
    slug: "hra",
    title: "HRA Exemption Calculator",
    tagline: "How much House Rent Allowance is tax-free",
    description:
      "HRA exemption calculator (Section 10(13A)). Find the tax-free portion of your House Rent Allowance based on salary, rent paid, and city.",
    keywords: ["hra calculator", "hra exemption", "house rent allowance", "section 10 13a"],
    gradient: "from-cyan-500/25 via-blue-400/10 to-transparent",
    icon: "🏠",
    intro:
      "If you receive House Rent Allowance and pay rent, part of it is tax-exempt under Section 10(13A). The exemption is the least of three values. Enter annual figures to see how much is tax-free.",
    faqs: [
      {
        q: "How is HRA exemption calculated?",
        a: "It's the least of: actual HRA received, rent paid minus 10% of basic salary, and 50% of basic (metro) or 40% (non-metro). The rest of your HRA is taxable.",
      },
      {
        q: "Which cities count as metro for HRA?",
        a: "Delhi, Mumbai, Kolkata, and Chennai are treated as metro cities (50% of basic). All other cities use 40%.",
      },
    ],
  },
  {
    slug: "income-tax",
    title: "Income Tax Calculator",
    tagline: "Old vs new regime for FY 2025-26",
    description:
      "Income tax calculator for FY 2025-26 (AY 2026-27). Compare the old and new tax regimes and see which one saves you more, including the latest slabs and rebate.",
    keywords: ["income tax calculator", "old vs new regime", "fy 2025-26 tax", "tax slabs india"],
    gradient: "from-fuchsia-500/25 via-purple-400/10 to-transparent",
    icon: "🧾",
    intro:
      "The new tax regime is the default, but the old regime can still win if you claim large deductions (80C, 80D, HRA, home loan interest). Enter your income and deductions to compare both for FY 2025-26.",
    faqs: [
      {
        q: "What are the new regime slabs for FY 2025-26?",
        a: "Nil up to ₹4L, 5% (₹4–8L), 10% (₹8–12L), 15% (₹12–16L), 20% (₹16–20L), 25% (₹20–24L), and 30% above ₹24L. A Section 87A rebate makes income up to ₹12L effectively tax-free.",
      },
      {
        q: "Should I choose old or new regime?",
        a: "If your total deductions are large, the old regime may be cheaper; otherwise the new regime usually wins. This calculator computes both and highlights the cheaper one. It's an estimate — confirm with a tax professional.",
      },
    ],
  },
]

export const TOOL_SLUGS: readonly string[] = TOOLS.map((t) => t.slug)

export function getTool(slug: string): ToolDef | undefined {
  return TOOLS.find((t) => t.slug === slug)
}
