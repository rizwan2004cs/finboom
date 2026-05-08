"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/hooks/use-auth"
import { useUser as useClerkUser } from "@clerk/nextjs"
import Link from "next/link"
import { Clipboard, Check, Sparkles } from "lucide-react"

const AI_PROMPT = `You are a financial content writer for FinBoom, a free net worth tracker for Indian investors.

STRICT RULES:
- ZERO emojis anywhere in output
- Indian context only: INR amounts, Indian tax laws, Indian instruments (PPF, NPS, EPF, ELSS, FDs, SGBs, etc.)
- Conversational tone, like a smart friend explaining finance
- No jargon without explanation
- Short paragraphs (2-3 sentences max)

OUTPUT FORMAT:
Return each field in its OWN SEPARATE code block so each can be copied individually.
Use exactly this format with 4 separate fenced code blocks:

TITLE:
\`\`\`
<title here, under 70 chars>
\`\`\`

CATEGORY:
\`\`\`
<one of: guides | tips | market | product>
\`\`\`

EXCERPT:
\`\`\`
<1-2 sentence summary, under 160 chars>
\`\`\`

CONTENT:
\`\`\`
<full markdown body here>
\`\`\`

MARKDOWN RULES (the blog engine ONLY supports these):
- ## for main sections, ### for sub-sections (NO # H1)
- **bold text**
- \`inline code\` for numbers, formulas, tickers
- > blockquote for key takeaways
- - bullet lists (dash only, not asterisk)
- 1. numbered lists
- ![alt text](image-url) for images (use relevant free stock image URLs from unsplash/pexels)
- | tables | with | pipes | for comparisons (include header row and separator row)
- \`\`\`mermaid code blocks — use generously to visualize concepts:
  - Flowcharts: graph TD / graph LR
  - Pie charts: pie title "Title"
  - Bar charts: xychart-beta (x-axis, y-axis, bar, line)
  - Timelines: timeline
  - Quadrant charts: quadrantChart
- Blank lines between paragraphs

DO NOT USE: links, ---, ~~strikethrough~~, *italic*, nested lists, HTML, emojis

REFERENCE BLOG POST (match this exact style, depth, and structure):
---
TITLE: Fundamental Analysis: A Beginner's Guide to Reading Stocks Like a Pro
CATEGORY: guides
EXCERPT: Learn the basics of fundamental analysis - from P/E ratios to debt-to-equity - explained simply so you can pick better stocks.
CONTENT:
## What is Fundamental Analysis?

Imagine you are buying a business, not just a stock ticker. Fundamental analysis is exactly that - studying a company's financial health, earnings, and growth to decide if its stock price is fair, cheap, or expensive.

While technical analysis looks at charts and patterns, fundamental analysis looks at the business behind the stock. Think of it as checking the engine before buying a car.

## The Key Numbers You Need to Know

### 1. EPS (Earnings Per Share)

EPS tells you how much profit a company makes for each share you own. If a company earns \`100 crore\` and has \`10 crore\` shares, the EPS is \`10\`.

Higher EPS = more profitable. But always compare EPS with companies in the same industry - comparing Infosys with Tata Steel does not make sense.

### 2. P/E Ratio (Price-to-Earnings)

The P/E ratio is the most popular valuation metric. It tells you how much investors are willing to pay for \`1\` of earnings.

**Formula:** \`P/E = Stock Price / EPS\`

A P/E of \`20\` means investors pay \`20\` for every \`1\` the company earns. A low P/E might mean the stock is undervalued (or struggling). A high P/E could mean it is overvalued (or growing fast).

> Nifty 50's average P/E hovers around 20-22. Stocks trading well above this need strong growth to justify the premium.

### 3. P/B Ratio (Price-to-Book)

P/B compares the stock price with the company's book value (assets minus liabilities, per share). A P/B of \`1\` means you are paying exactly what the company's assets are worth on paper.

P/B below \`1\`? The stock might be a bargain - or the company might be in trouble. Banks and NBFCs are best evaluated using P/B since their main business is lending money.

### 4. ROE (Return on Equity)

ROE measures how efficiently a company uses shareholders' money to generate profits. An ROE of \`20%\` means the company generates \`20\` of profit for every \`100\` of equity.

Consistently high ROE (above \`15%\`) is a sign of a quality business. Think Asian Paints, TCS, or HDFC Bank.

### 5. Debt-to-Equity Ratio (D/E)

This tells you how much debt the company has compared to its own money (equity). A D/E of \`0.5\` means for every \`100\` of equity, the company has \`50\` of debt.

Low D/E (below \`1\`) is generally safer. High D/E is not always bad - infra and real estate companies naturally carry more debt - but excessive debt during rising interest rates can crush profits.

### 6. Revenue and Profit Growth

A company can have great ratios today but if revenue is shrinking, those ratios will deteriorate. Look for consistent revenue and profit growth over 3-5 years, not just one great quarter.

> One quarter does not make a trend. Always check at least 3 years of results before drawing conclusions.

## Putting It All Together: A Quick Checklist

- EPS growing year over year?
- P/E reasonable compared to peers?
- ROE consistently above \`15%\`?
- Debt-to-Equity under control?
- Revenue and profit growing for 3+ years?
- Business you understand?

If a stock checks most of these boxes, it is worth deeper research. If it fails multiple checks, move on - there are thousands of stocks out there.

## Common Mistakes Beginners Make

**Buying only because P/E is low.** A low P/E can be a value trap - the stock might be cheap because the business is dying. Always check WHY the P/E is low.

**Ignoring debt.** Companies like Vodafone Idea or Yes Bank looked great on revenue - until their debt became unmanageable. Always check D/E.

**Chasing one metric.** No single number tells the full story. Use EPS, P/E, ROE, and D/E together to build a complete picture.

## Start Tracking Your Picks

Once you have done your fundamental analysis and invested, the next step is tracking how your portfolio performs. FinBoom lets you track all your stocks, mutual funds, and 22+ asset classes in one place - so you always know your true net worth.

> Import your Groww or Zerodha holdings in seconds and watch your wealth grow.
---

Write a new blog post on the topic I give you. Match the reference post's style exactly:
- Same depth of explanation with Indian examples
- Same use of \`backticks\` for numbers
- Same mix of ##/### headings, bold key terms, blockquote callouts, bullet checklists
- Same conversational but authoritative tone
- Same length (800-1500 words)
- End with a natural FinBoom mention (not salesy)
- ZERO emojis`

function markdownToPortableText(markdown: string) {
  const lines = markdown.split("\n")
  const blocks: Array<Record<string, unknown>> = []
  let keyCounter = 0
  let inList = false
  let listItems: Array<Record<string, unknown>> = []

  function nextKey() {
    return `k${++keyCounter}`
  }

  function parseInline(text: string) {
    const spans: Array<Record<string, unknown>> = []
    const regex = /\*\*(.+?)\*\*|__(.+?)__|`(.+?)`/g
    let lastIndex = 0
    let match

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        spans.push({ _type: "span", _key: nextKey(), text: text.slice(lastIndex, match.index), marks: [] })
      }
      if (match[1] || match[2]) {
        spans.push({ _type: "span", _key: nextKey(), text: match[1] || match[2], marks: ["strong"] })
      } else if (match[3]) {
        spans.push({ _type: "span", _key: nextKey(), text: match[3], marks: ["code"] })
      }
      lastIndex = regex.lastIndex
    }

    if (lastIndex < text.length) {
      spans.push({ _type: "span", _key: nextKey(), text: text.slice(lastIndex), marks: [] })
    }

    if (spans.length === 0) {
      spans.push({ _type: "span", _key: nextKey(), text, marks: [] })
    }

    return spans
  }

  function flushList() {
    if (listItems.length > 0) {
      blocks.push(...listItems)
      listItems = []
      inList = false
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Blank line
    if (line.trim() === "") {
      flushList()
      continue
    }

    // Mermaid code block: ```mermaid ... ```
    if (line.trim() === "```mermaid") {
      flushList()
      const mermaidLines: string[] = []
      let j = i + 1
      while (j < lines.length && lines[j].trim() !== "```") {
        mermaidLines.push(lines[j])
        j++
      }
      if (mermaidLines.length > 0) {
        blocks.push({
          _type: "mermaid",
          _key: nextKey(),
          code: mermaidLines.join("\n"),
        })
      }
      i = j // skip closing ```
      continue
    }

    // Table: detect | ... | rows and collect them
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      flushList()
      const tableRows: string[][] = []
      let j = i
      while (j < lines.length && lines[j].trim().startsWith("|") && lines[j].trim().endsWith("|")) {
        const row = lines[j].trim().slice(1, -1).split("|").map(c => c.trim())
        // Skip separator rows like |---|---|
        if (!row.every(c => /^[-:]+$/.test(c))) {
          tableRows.push(row)
        }
        j++
      }
      if (tableRows.length > 0) {
        blocks.push({
          _type: "table",
          _key: nextKey(),
          rows: tableRows.map((cells, ri) => ({
            _type: "tableRow",
            _key: nextKey(),
            isHeader: ri === 0,
            cells: cells.map(cell => ({
              _type: "tableCell",
              _key: nextKey(),
              text: cell,
            })),
          })),
        })
      }
      i = j - 1
      continue
    }

    // Image: ![alt](url)
    const imageMatch = line.match(/^!\[(.*)\]\((.+)\)$/)
    if (imageMatch) {
      flushList()
      blocks.push({
        _type: "externalImage",
        _key: nextKey(),
        url: imageMatch[2].trim(),
        alt: imageMatch[1].trim() || "",
      })
      continue
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/)
    if (headingMatch) {
      flushList()
      const level = headingMatch[1].length
      const style = level === 1 ? "h2" : level === 2 ? "h2" : "h3"
      blocks.push({
        _type: "block",
        _key: nextKey(),
        style,
        markDefs: [],
        children: [{ _type: "span", _key: nextKey(), text: headingMatch[2].trim(), marks: [] }],
      })
      continue
    }

    // Blockquote
    if (line.startsWith("> ")) {
      flushList()
      blocks.push({
        _type: "block",
        _key: nextKey(),
        style: "blockquote",
        markDefs: [],
        children: parseInline(line.slice(2).trim()),
      })
      continue
    }

    // Bullet list
    const bulletMatch = line.match(/^[-*]\s+(.+)/)
    if (bulletMatch) {
      inList = true
      listItems.push({
        _type: "block",
        _key: nextKey(),
        style: "normal",
        listItem: "bullet",
        level: 1,
        markDefs: [],
        children: parseInline(bulletMatch[1].trim()),
      })
      continue
    }

    // Numbered list
    const numMatch = line.match(/^\d+\.\s+(.+)/)
    if (numMatch) {
      inList = true
      listItems.push({
        _type: "block",
        _key: nextKey(),
        style: "normal",
        listItem: "number",
        level: 1,
        markDefs: [],
        children: parseInline(numMatch[1].trim()),
      })
      continue
    }

    // Normal paragraph
    flushList()
    blocks.push({
      _type: "block",
      _key: nextKey(),
      style: "normal",
      markDefs: [],
      children: parseInline(line.trim()),
    })
  }

  flushList()
  return blocks
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
}

function CopyPromptButton() {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(AI_PROMPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-medium border transition-all cursor-pointer
        border-black/10 dark:border-white/10 text-[#6e6e73] dark:text-[#98989d]
        hover:bg-black/[0.03] dark:hover:bg-white/[0.03] hover:text-[#1d1d1f] dark:hover:text-white
        active:scale-[0.97]"
      title="Copy AI prompt for generating blog content"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-accent" strokeWidth={2} />
          <span className="text-accent">Copied</span>
        </>
      ) : (
        <>
          <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />
          <span>AI Prompt</span>
          <Clipboard className="w-3.5 h-3.5" strokeWidth={2} />
        </>
      )}
    </button>
  )
}

export default function NewBlogPost() {
  const { user, isLoaded } = useUser()
  const { user: clerkUser } = useClerkUser()
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("guides")
  const [excerpt, setExcerpt] = useState("")
  const [markdown, setMarkdown] = useState("")
  const [status, setStatus] = useState<"idle" | "publishing" | "success" | "error">("idle")
  const [message, setMessage] = useState("")

  const role = (clerkUser?.publicMetadata as { role?: string })?.role
  const isAdmin = role === "admin" || role === "editor"

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <p className="text-[#86868b]">Loading...</p>
      </div>
    )
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-[#1d1d1f] dark:text-white mb-2">Access Denied</p>
          <p className="text-sm text-[#86868b] mb-4">You need admin access to create blog posts.</p>
          <Link href="/blog" className="text-sm text-accent hover:opacity-80 transition-opacity">
            ← Back to blog
          </Link>
        </div>
      </div>
    )
  }

  async function handlePublish() {
    if (!title.trim() || !markdown.trim()) {
      setMessage("Title and content are required.")
      setStatus("error")
      return
    }

    setStatus("publishing")
    setMessage("")

    const body = markdownToPortableText(markdown)

    const post = {
      _type: "post",
      title: title.trim(),
      slug: { _type: "slug", current: slugify(title) },
      category,
      excerpt: excerpt.trim(),
      publishedAt: new Date().toISOString(),
      body,
    }

    try {
      const res = await fetch("/api/blog/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post }),
      })

      const data = await res.json()

      if (res.ok) {
        const slug = slugify(title)
        router.push(`/blog/${slug}`)
      } else {
        setStatus("error")
        setMessage(data.error || "Failed to publish.")
      }
    } catch {
      setStatus("error")
      setMessage("Network error. Check your connection.")
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <header>
        <nav className="sticky top-0 z-50 glass-elevated border-b border-black/[0.04] dark:border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 lg:px-10 h-14 flex items-center justify-between">
            <Link href="/" className="text-[22px] font-bold tracking-[-0.5px] text-[#1d1d1f] dark:text-white">
              FinBoom
            </Link>
            <Link href="/blog" className="text-[15px] font-medium text-[#1d1d1f] dark:text-white px-3 py-1.5 rounded-xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] active:scale-95 transition-all duration-200">
              Blog
            </Link>
          </div>
        </nav>
      </header>

      <main className="max-w-[720px] mx-auto px-6 py-16">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-[#1d1d1f] dark:text-white font-serif">
            New Blog Post
          </h1>
          <CopyPromptButton />
        </div>

        <div className="space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-[#1d1d1f] dark:text-white mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Fundamental Analysis: A Beginner's Guide"
              className="w-full px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-[#1d1d1f] dark:text-white mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 text-[#1d1d1f] dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              <option value="guides">Guides</option>
              <option value="tips">Financial Tips</option>
              <option value="market">Market Updates</option>
              <option value="product">Product Updates</option>
            </select>
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-sm font-medium text-[#1d1d1f] dark:text-white mb-1.5">
              Excerpt
            </label>
            <input
              type="text"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="A short summary for the blog card..."
              className="w-full px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          {/* Markdown Content */}
          <div>
            <label className="block text-sm font-medium text-[#1d1d1f] dark:text-white mb-1.5">
              Content (Markdown)
            </label>
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              rows={20}
              placeholder={`## What is Fundamental Analysis?\n\nImagine you're buying a business, not just a stock ticker...\n\n### 1. EPS (Earnings Per Share)\n\nEPS tells you how much profit a company makes **per share**.\n\n> Pro tip: Always compare within the same industry.\n\n- Check EPS growth\n- Compare with peers`}
              className="w-full px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-accent/30 font-mono text-sm leading-relaxed resize-y"
            />
            <p className="mt-1 text-xs text-[#86868b]">
              Supports: ## headings, ### subheadings, **bold**, `code`, &gt; blockquotes, - bullet lists, 1. numbered lists, ![alt](image-url), | tables |, ```mermaid (flowcharts, pie, bar, timeline)
            </p>
          </div>

          {/* Status Message */}
          {message && (
            <div className={`px-4 py-3 rounded-xl text-sm ${
              status === "success"
                ? "bg-green-500/10 text-green-700 dark:text-green-400"
                : "bg-red-500/10 text-red-700 dark:text-red-400"
            }`}>
              {message}
            </div>
          )}

          {/* Publish Button */}
          <button
            onClick={handlePublish}
            disabled={status === "publishing"}
            className="w-full py-3 rounded-xl bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "publishing" ? "Publishing..." : "Publish Post"}
          </button>
        </div>
      </main>
    </div>
  )
}
