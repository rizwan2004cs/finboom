"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/hooks/use-auth"
import { useUser as useClerkUser } from "@clerk/nextjs"
import Link from "next/link"
import { Sparkles, Loader2 } from "lucide-react"
import { BLOG_CATEGORIES } from "@/lib/blog/categories"

function stripMarks(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .trim()
}

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

    // Key-takeaways brief: ```keypoints ... ```
    if (/^```\s*keypoints\s*$/i.test(line.trim())) {
      flushList()
      const items: string[] = []
      let j = i + 1
      while (j < lines.length && lines[j].trim() !== "```") {
        const clean = stripMarks(lines[j].trim().replace(/^[-*]\s+/, ""))
        if (clean) items.push(clean)
        j++
      }
      if (items.length > 0) {
        blocks.push({ _type: "callout", _key: nextKey(), style: "keypoints", items })
      }
      i = j
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
              text: stripMarks(cell),
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


export default function NewBlogPost() {
  const { user, isLoaded } = useUser()
  const { user: clerkUser } = useClerkUser()
  const router = useRouter()
  const [topic, setTopic] = useState("")
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("guides")
  const [excerpt, setExcerpt] = useState("")
  const [markdown, setMarkdown] = useState("")
  const [heroImageUrl, setHeroImageUrl] = useState("")
  const [heroImageAlt, setHeroImageAlt] = useState("")
  const [seo, setSeo] = useState<{
    metaTitle?: string
    metaDescription?: string
    primaryKeyword?: string
    keywords?: string[]
  }>({})
  const [status, setStatus] = useState<"idle" | "generating" | "publishing" | "success" | "error">("idle")
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

  async function handleGenerate() {
    if (!topic.trim()) {
      setMessage("Enter a topic to generate a blog post.")
      setStatus("error")
      return
    }

    setStatus("generating")
    setMessage("")

    try {
      const res = await fetch("/api/blog/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
      })

      const data = await res.json()

      if (res.ok) {
        setTitle(data.title || "")
        setCategory(data.category || "guides")
        setExcerpt(data.excerpt || "")
        setMarkdown(data.content || "")
        setHeroImageUrl(data.heroImageUrl || "")
        setHeroImageAlt(data.heroImageAlt || "")
        setSeo({
          metaTitle: data.metaTitle,
          metaDescription: data.metaDescription,
          primaryKeyword: data.primaryKeyword,
          keywords: Array.isArray(data.keywords) ? data.keywords : undefined,
        })
        setStatus("idle")
        setMessage("")
      } else {
        setStatus("error")
        setMessage(data.error || "Failed to generate. Try again.")
      }
    } catch {
      setStatus("error")
      setMessage("Network error. Check your connection.")
    }
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
      ...(seo.metaTitle && { metaTitle: seo.metaTitle }),
      ...(seo.metaDescription && { metaDescription: seo.metaDescription }),
      ...(seo.keywords?.length && { keywords: seo.keywords }),
      // The server uploads heroImageUrl into Sanity as mainImage, then strips it.
      ...(heroImageUrl && { heroImageUrl, heroImageAlt }),
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
        </div>

        <div className="space-y-5">
          {/* AI Generate Section */}
          <div className="p-5 rounded-2xl border border-accent/20 bg-accent/[0.03]">
            <label className="block text-sm font-medium text-[#1d1d1f] dark:text-white mb-1.5">
              Generate with AI
            </label>
            <p className="text-xs text-[#86868b] mb-3">
              Enter a topic and the AI will write a complete blog post for you.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && status !== "generating") handleGenerate()
                }}
                placeholder="e.g. FIRE Movement for Indian Investors, SIP vs Lumpsum..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-accent/30"
                disabled={status === "generating"}
              />
              <button
                onClick={handleGenerate}
                disabled={status === "generating"}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {status === "generating" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" strokeWidth={2} />
                    <span>Generate</span>
                  </>
                )}
              </button>
            </div>
          </div>

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
              {BLOG_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
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

          {/* Hero image */}
          {heroImageUrl && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-[#1d1d1f] dark:text-white">
                  Hero image
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setHeroImageUrl("")
                    setHeroImageAlt("")
                  }}
                  className="text-xs text-red-600 dark:text-red-400 hover:opacity-80"
                >
                  Remove
                </button>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImageUrl}
                alt={heroImageAlt || title}
                className="w-full max-h-56 object-cover rounded-xl border border-black/10 dark:border-white/10"
              />
              <p className="mt-1 text-xs text-[#86868b]">
                Uploaded to Sanity as the post&apos;s main image on publish.
              </p>
            </div>
          )}

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
                ? "bg-black/5 text-[#1d1d1f] dark:bg-white/10 dark:text-white"
                : "bg-red-500/10 text-red-700 dark:text-red-400"
            }`}>
              {message}
            </div>
          )}

          {/* Publish Button */}
          <button
            onClick={handlePublish}
            disabled={status === "publishing" || status === "generating"}
            className="w-full py-3 rounded-xl bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "publishing" ? "Publishing..." : "Publish Post"}
          </button>
        </div>
      </main>
    </div>
  )
}
