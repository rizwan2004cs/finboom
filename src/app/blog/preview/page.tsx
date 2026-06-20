import { PortableText } from "@portabletext/react"
import Link from "next/link"
import type { Metadata } from "next"
import { markdownToPortableText } from "@/lib/blog/markdown-to-portable-text"
import { portableTextComponents } from "../[slug]/page"

// Dev-only showcase of the new "visual-first" auto-post format: a key-takeaways
// brief, bold section gists, multiple mermaid diagrams and comparison tables.
// It renders hand-authored sample markdown through the SAME converter +
// renderer the live blog uses, so it needs no AI keys or Sanity access.
export const metadata: Metadata = {
  title: "Blog format preview",
  robots: { index: false, follow: false },
}

const SAMPLE_MARKDOWN = `\`\`\`keypoints
The 50-30-20 rule turns your salary into a simple, repeatable system.
Build a 6-month emergency fund before you chase higher returns.
ELSS and PPF both cut tax under 80C, but suit very different risk appetites.
Automating SIPs on salary day removes the temptation to skip a month.
\`\`\`

## The big picture

**The gist:** treat your salary like a system, not a monthly surprise — set the flow up once and let it run on autopilot.

Most of us check our balance, spend until it feels uncomfortable, then save whatever is left. The fix is to flip the order: decide where money goes the day it arrives.

\`\`\`mermaid
graph TD
A[Monthly Salary] --> B[Needs 50 percent]
A --> C[Wants 30 percent]
A --> D[Savings 20 percent]
D --> E[Emergency Fund]
D --> F[Investments]
\`\`\`

## Where your money should go

**The gist:** split take-home pay into three buckets so every rupee has a job before you spend it.

A salary of \`INR 80,000\` splits cleanly into needs, wants and savings. Keep the buckets visible and the plan survives a busy month.

| Bucket | Share | Example use |
|---|---|---|
| Needs | 50% | Rent, EMI, groceries, bills |
| Wants | 30% | Dining out, travel, gadgets |
| Savings | 20% | SIP, PPF, emergency fund |

\`\`\`mermaid
pie title Monthly take-home allocation
"Needs" : 50
"Wants" : 30
"Savings" : 20
\`\`\`

## 80C showdown: ELSS vs PPF

**The gist:** pick ELSS for growth with a short lock-in, PPF for guaranteed, tax-free safety.

Both save up to \`INR 1.5 lakh\` under Section 80C, but they behave very differently once your money is in.

| Feature | ELSS | PPF |
|---|---|---|
| Lock-in | 3 years | 15 years |
| Returns | Market-linked | ~7.1% fixed |
| Risk | Higher | Very low |

\`\`\`mermaid
graph LR
A[Want higher long term returns] --> B[Choose ELSS]
C[Want guaranteed safety] --> D[Choose PPF]
\`\`\`

## Make it automatic

**The gist:** pay yourself first by scheduling investments for the day after payday.

> The single best money habit is automation: decide once, and never rely on willpower again.

Set SIP dates to the 2nd or 3rd of the month so the money leaves before you can spend it.

## Track it all in FinBoom

**The gist:** a plan only works if you can see it — track every bucket and investment in one place.

Once the system is running, FinBoom shows your true net worth across \`22+\` asset classes so you always know if you are on track.`

export default function BlogPreviewPage() {
  const body = markdownToPortableText(SAMPLE_MARKDOWN)

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <header>
        <nav className="sticky top-0 z-50 glass-elevated border-b border-black/[0.04] dark:border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 lg:px-10 h-14 flex items-center justify-between">
            <Link href="/" className="text-[22px] font-bold tracking-[-0.5px] text-[#1d1d1f] dark:text-white">
              FinBoom
            </Link>
            <span className="text-xs font-medium text-accent uppercase tracking-wider font-mono">
              Format preview
            </span>
          </div>
        </nav>
      </header>

      <article className="max-w-[720px] mx-auto px-6 py-16">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-xs font-medium text-accent uppercase tracking-wider font-mono">
            Guides
          </span>
          <span className="text-[#86868b] dark:text-[#636366]">·</span>
          <span className="text-xs text-[#86868b] dark:text-[#636366] font-mono">
            visual-first sample
          </span>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[#1d1d1f] dark:text-white leading-tight font-serif">
          How to Budget Your Salary in India: The 50-30-20 System
        </h1>
        <p className="mt-4 text-lg text-[#6e6e73] dark:text-[#98989d]">
          A skimmable walkthrough — read the brief and the diagrams in 60 seconds, or dive into the prose for depth.
        </p>

        <div className="mt-10 prose-lg">
          {/* @ts-expect-error - PortableText component typing is complex */}
          <PortableText value={body} components={portableTextComponents} />
        </div>
      </article>
    </div>
  )
}
