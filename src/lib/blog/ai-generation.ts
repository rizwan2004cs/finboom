import { GoogleGenerativeAI } from "@google/generative-ai"
import { injectInlineImages, resolveHeroImage, createImageResolver } from "@/lib/blog/images"
import {
  BLOG_CATEGORY_IDS,
  normalizeBlogCategory,
  type BlogCategory,
} from "@/lib/blog/categories"

export type GeneratedBlogPost = {
  title: string
  category: BlogCategory
  excerpt: string
  content: string
  metaTitle?: string
  metaDescription?: string
  primaryKeyword?: string
  keywords: string[]
  heroImageUrl?: string
  heroImageAlt?: string
}

export type BlogGenerationOptions = {
  // When set, the post MUST use this category (set by the balancer).
  targetCategory?: BlogCategory
  // Trending/seasonal keywords to weave in for SEO.
  keywords?: string[]
  // Human-readable seasonal context, e.g. "March (timely: tax saving...)".
  seasonContext?: string
}

type BlogOutline = {
  title: string
  category: BlogCategory
  excerpt: string
  heroImageQuery: string
  metaTitle: string
  metaDescription: string
  primaryKeyword: string
  secondaryKeywords: string[]
  keyTakeaways: string[]
  sections: Array<{ heading: string; points: string[] }>
}

// The pipeline runs in stages so weaker fallback models (Groq llama,
// Gemini flash-lite) still produce long, well-structured posts:
//   1. Outline agent  -> title, category, excerpt, hero query, sections
//   2. Writer agent    -> full markdown body from the outline
//   3. Expand agent    -> only runs if the draft came back too short
// Images are sourced separately (see images.ts) from {{IMAGE}} tokens, so
// the model never invents broken photo URLs.

const TARGET_MIN_WORDS = 1500
const EXPAND_THRESHOLD_WORDS = 1300

function buildOutlinePrompt(topic: string, opts: BlogGenerationOptions): string {
  const categoryRule = opts.targetCategory
    ? `- Prefer the category "${opts.targetCategory}" IF the topic genuinely fits it; otherwise pick the single most accurate category from: ${BLOG_CATEGORY_IDS.join(" | ")}`
    : `- Choose the best "category" from: ${BLOG_CATEGORY_IDS.join(" | ")}`
  const keywordBlock = opts.keywords?.length
    ? `\n\nTARGET SEARCH KEYWORDS (weave the most relevant ones in naturally; never stuff):\n${opts.keywords.join(", ")}`
    : ""
  const seasonBlock = opts.seasonContext
    ? `\n\nSEASONAL CONTEXT (use only if naturally relevant to the topic): ${opts.seasonContext}`
    : ""

  return `You are the editor for FinBoom, a free net worth tracker for Indian investors.

Plan a long-form, SEO-optimized blog post on the topic given below. Return ONLY valid JSON:
{
  "title": "<compelling, keyword-rich title, under 65 chars, no emojis>",
  "category": "<one of: ${BLOG_CATEGORY_IDS.join(" | ")}>",
  "excerpt": "<1-2 sentence summary, under 160 chars>",
  "metaTitle": "<SEO title tag, max 60 chars, primary keyword near the front>",
  "metaDescription": "<SEO meta description, max 155 chars, compelling and keyword-rich>",
  "primaryKeyword": "<the main search phrase this post should rank for>",
  "secondaryKeywords": ["<related long-tail keyword>", "<another related keyword>"],
  "heroImageQuery": "<2-4 word CONCRETE, photographable visual query, e.g. 'indian family budgeting'>",
  "keyTakeaways": ["<one-line takeaway a reader gets without reading the body>", "<another>", "<3 to 5 total>"],
  "sections": [
    {
      "heading": "<section heading, no numbering>",
      "points": ["<specific point to cover>", "<another concrete point>"]
    }
  ]
}

RULES:
${categoryRule}
- 7 to 9 sections that flow logically from hook to conclusion
- First section is an engaging hook; last section ties back to FinBoom
- Each section needs 3-5 concrete, non-overlapping points
- keyTakeaways: 3-5 punchy, standalone one-liners that summarise the whole post (the "brief" a skimmer reads first); include a concrete number where natural
- Indian context only: INR amounts, Indian tax laws, Indian instruments (PPF, NPS, EPF, ELSS, FDs, SGBs, mutual funds, SIPs)
- Cover the topic with real depth: definitions, examples with numbers, comparisons, common mistakes, actionable steps
- heroImageQuery must be a concrete, photographable subject (never an abstract concept)
- Zero emojis${keywordBlock}${seasonBlock}`
}

// Shared formatting contract for both the writer and expand passes.
const MARKDOWN_RULES = `MARKDOWN RULES (the blog engine ONLY supports these):
- ## for main sections, ### for sub-sections (NO # H1)
- **bold text** for key terms and emphasis
- \`inline code\` for numbers, amounts, percentages, formulas in PROSE: \`INR 6 lakh\`, \`40%\`, \`25x\` (do NOT use backticks inside tables, diagrams, or the keypoints block)
- > blockquote for a single memorable quote or rule of thumb
- - bullet lists (dash only, not asterisk)
- 1. numbered lists
- Blank lines between paragraphs

VISUAL-FIRST STRUCTURE (this is the most important rule — readers should grasp the post by skimming visuals, then read prose only if they want depth):
1. Begin the body with a key-takeaways brief, BEFORE the first \`##\` heading, in EXACTLY this fenced form:
\`\`\`keypoints
First takeaway as a complete, standalone sentence
Second takeaway
Third takeaway
\`\`\`
   (3-5 lines, one takeaway per line, no bullets/numbers/backticks inside.)
2. Every \`##\` section must OPEN with a one-line **bold** summary sentence (the gist), then the supporting prose. A skimmer reading only the bold openers should understand the whole post.
3. Use plenty of visuals so most sections carry one:
   - 2 to 4 \`\`\`mermaid diagrams total — at least one near the top as a visual overview/decision flow.
   - At least 2 markdown | tables | for comparisons, steps, or numbers.

MERMAID RULES (invalid diagrams are silently dropped, so follow EXACTLY):
- ONLY these two types:
  - Flowcharts: "graph TD" or "graph LR" with simple A[Label] --> B[Label] nodes
  - Pie charts: pie title Title  then  "Label" : value  lines
- STRICT: plain ASCII only (--> arrows, straight quotes), no parentheses, colons, commas or special characters inside node labels, no other diagram types

TABLE RULES: every row MUST start AND end with a pipe "|", including the header and a |---|---| separator row directly beneath the header. Keep cells short and plain-text (no backticks or bold inside cells). Exactly like:
| Option | Lock-in | Returns |
|---|---|---|
| ELSS | 3 years | Market-linked |
| PPF | 15 years | ~7.1% fixed |

IMAGES: do NOT write any image markdown or URLs. Instead, immediately after 3 to 4 of the
\`##\` section headings, put an image placeholder on its own line in this exact form:
{{IMAGE: 2-4 word visual search query}}
Make each query concrete and visual (e.g. {{IMAGE: indian rupee coins}}, {{IMAGE: stock market chart}}).

DO NOT USE: image URLs, links, ---, ~~strikethrough~~, *italic*, nested lists, HTML, emojis

STYLE:
- After the keypoints brief, start the prose with an engaging hook that makes the reader imagine a scenario
- Short paragraphs (1-3 sentences), often a single line for dramatic effect
- Bold key terms when first introduced
- Conversational but authoritative, like a smart friend explaining finance
- End with a natural, non-salesy FinBoom mention that ties into the topic
- ZERO emojis anywhere`

function buildWriterPrompt(topic: string, outline: BlogOutline): string {
  const sectionPlan = outline.sections
    .map((section, index) => {
      const points = section.points.map((point) => `   - ${point}`).join("\n")
      return `${index + 1}. ${section.heading}\n${points}`
    })
    .join("\n")

  const takeawaysSeed = outline.keyTakeaways.length
    ? `\n\nOpen the post with this key-takeaways brief (refine the wording, keep 3-5 lines):\n\`\`\`keypoints\n${outline.keyTakeaways.join("\n")}\n\`\`\``
    : ""

  return `You are a financial content writer for FinBoom, a free net worth tracker for Indian investors.

Write the FULL blog post body in markdown for this topic: "${topic}"

Make it scannable: a reader should get the whole point from the key-takeaways brief, the bold
section openers, the tables and the diagrams — and only read the prose for depth.${takeawaysSeed}

Follow this section plan in order, using each heading as a \`##\` section. Open each section with a
one-line **bold** summary, then expand every point into rich, specific prose (aim for 250-400 words
per section):

${sectionPlan}

Write 1800-2800 words total. Do not skip sections. Add depth with concrete Indian examples and
real numbers. Include the key-takeaways brief at the very top, 2-4 mermaid diagrams (one near the
top), and at least 2 comparison tables.
${buildSeoLine(outline)}

${MARKDOWN_RULES}

Return ONLY valid JSON: { "markdown": "<full markdown body>" }`
}

function buildSeoLine(outline: BlogOutline): string {
  if (!outline.primaryKeyword) return ""
  const secondary = outline.secondaryKeywords.length
    ? ` Also use these related terms where they fit naturally: ${outline.secondaryKeywords.join(", ")}.`
    : ""
  return `\nSEO: Weave the primary keyword "${outline.primaryKeyword}" naturally into the first 100 words, at least two ## headings, and the conclusion.${secondary} Never keyword-stuff; the prose must read naturally.`
}

function buildExpandPrompt(topic: string, draft: string): string {
  return `You are an editor for FinBoom. The following draft blog post on "${topic}" is too short and
thin. Rewrite it to be noticeably longer and more valuable: expand each section with more
explanation, concrete Indian examples, and numbers. Keep every \`##\` heading and its one-line
**bold** opener, keep the {{IMAGE: ...}} placeholders, keep the \`\`\`keypoints brief at the top,
and keep (or add up to 2-4) mermaid diagrams and at least 2 tables. Target 2000+ words.

${MARKDOWN_RULES}

Return ONLY valid JSON: { "markdown": "<expanded markdown body>" }

DRAFT TO EXPAND:
${draft}`
}

const TOPIC_FALLBACK_PROMPT = `You are helping run an Indian personal-finance blog.

Generate a JSON object with this exact shape:
{
  "topics": ["topic 1", "topic 2", "topic 3"]
}

Rules:
- Give 15 topic ideas
- Topics must fit FinBoom and SPAN these categories (roughly 3-4 each): guides/how-tos, investing (stocks/mutual funds/SIP), taxes (income tax/80C/capital gains), retirement (NPS/PPF/EPF/FIRE), and market/news explainers
- Prefer currently relevant/trending angles for Indian users
- Avoid duplicates or near-duplicates
- Each topic should be specific and blog-ready
- Zero emojis`

// LLMs sometimes emit raw newlines/tabs inside JSON string values,
// which is invalid JSON. Escape control characters that appear inside
// strings while leaving structural whitespace untouched.
function escapeControlCharsInStrings(text: string): string {
  let result = ""
  let inString = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inString && char === "\\") {
      result += char + (text[i + 1] ?? "")
      i += 1
      continue
    }
    if (char === '"') {
      inString = !inString
      result += char
      continue
    }
    if (inString && char.charCodeAt(0) < 0x20) {
      result +=
        char === "\n" ? "\\n" : char === "\r" ? "\\r" : char === "\t" ? "\\t" : ""
      continue
    }
    result += char
  }
  return result
}

function parseJsonSafely<T>(text: string): T | null {
  const candidates = [text]
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) candidates.push(jsonMatch[0])

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T
    } catch {
      try {
        return JSON.parse(escapeControlCharsInStrings(candidate)) as T
      } catch {
        // try the next candidate
      }
    }
  }
  return null
}

// Models to try in order. Older models get dropped from the free tier
// (gemini-2.0-flash now has a free-tier limit of 0), so a quota or
// not-found error on one model falls through to the next.
const GEMINI_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
].filter((model): model is string => Boolean(model))

// Groq is the cross-provider backstop when every Gemini model is
// rate-limited or down. Its API is OpenAI-compatible.
const GROQ_MODELS = [
  process.env.GROQ_MODEL,
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
].filter((model): model is string => Boolean(model))

function getGeminiClient(modelName: string) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.")
  }
  const genAI = new GoogleGenerativeAI(apiKey)
  return genAI.getGenerativeModel({ model: modelName })
}

// Transient availability/capacity failures worth retrying on another
// model or provider. Anything else (bad request, auth) is a real bug
// and should surface immediately.
function isModelUnavailableError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  return /\b(413|429|404|500|503|quota|not found|unavailable|overloaded|high demand|too large|truncated|RESOURCE_EXHAUSTED|INTERNAL)\b/i.test(
    message
  )
}

export type GenerateOptions = {
  temperature: number
  maxOutputTokens: number
}

async function generateWithGemini(prompt: string, options: GenerateOptions): Promise<string> {
  let lastError: unknown = null
  for (const modelName of GEMINI_MODELS) {
    try {
      const model = getGeminiClient(modelName)
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options.temperature,
          maxOutputTokens: options.maxOutputTokens,
          responseMimeType: "application/json",
          // Gemini 2.5 models bill "thinking" tokens against
          // maxOutputTokens, which can truncate long JSON mid-stream.
          // The SDK passes unknown config fields through to the API.
          ...({ thinkingConfig: { thinkingBudget: 0 } } as Record<string, unknown>),
        },
      })
      const finishReason = result.response.candidates?.[0]?.finishReason
      if (finishReason === "MAX_TOKENS") {
        throw new Error(`Gemini response truncated (MAX_TOKENS) on ${modelName}.`)
      }
      return result.response.text()
    } catch (err) {
      lastError = err
      if (!isModelUnavailableError(err)) throw err
    }
  }
  throw lastError instanceof Error ? lastError : new Error("All Gemini models are unavailable.")
}

type OpenAICompatibleProvider = {
  name: string
  url: string
  apiKey: string
  models: string[]
  // Per-model completion caps; exceeding them is a 400, not a fallback.
  completionCaps: Record<string, number>
  defaultCap: number
  tokenParam: "max_tokens" | "max_completion_tokens"
}

async function generateWithOpenAICompatible(
  provider: OpenAICompatibleProvider,
  prompt: string,
  options: GenerateOptions
): Promise<string> {
  let lastError: unknown = null
  for (const modelName of provider.models) {
    try {
      // Reasoning models (gpt-5*, o*) reject non-default temperature.
      const supportsTemperature = !/^(gpt-5|o\d)/.test(modelName)
      const response = await fetch(provider.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: "user", content: prompt }],
          ...(supportsTemperature && { temperature: options.temperature }),
          [provider.tokenParam]: Math.min(
            options.maxOutputTokens,
            provider.completionCaps[modelName] ?? provider.defaultCap
          ),
          response_format: { type: "json_object" },
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error?.message || `${provider.name} request failed (${response.status})`)
      }
      if (data.choices?.[0]?.finish_reason === "length") {
        throw new Error(`${provider.name} response truncated (length) on ${modelName}.`)
      }
      const text = data.choices?.[0]?.message?.content
      if (!text) {
        throw new Error(`${provider.name} returned an empty response.`)
      }
      return text
    } catch (err) {
      lastError = err
      if (!isModelUnavailableError(err)) throw err
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`All ${provider.name} models are unavailable.`)
}

function getGroqProvider(): OpenAICompatibleProvider | null {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null
  return {
    name: "Groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    apiKey,
    models: GROQ_MODELS,
    // Groq's free (on_demand) tier caps total request tokens well below
    // model limits - larger max_tokens values are rejected with HTTP 413.
    completionCaps: {
      "llama-3.3-70b-versatile": 8192,
      "llama-3.1-8b-instant": 8192,
    },
    defaultCap: 8192,
    tokenParam: "max_tokens",
  }
}

function getOpenAiProvider(): OpenAICompatibleProvider | null {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  return {
    name: "OpenAI",
    url: "https://api.openai.com/v1/chat/completions",
    apiKey,
    models: [process.env.OPENAI_MODEL, "gpt-4o-mini", "gpt-4.1-mini"].filter(
      (model): model is string => Boolean(model)
    ),
    completionCaps: {},
    defaultCap: 16384,
    tokenParam: "max_completion_tokens",
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Pull a server-suggested retry delay (in ms) out of a provider error message.
// Groq/OpenAI rate-limit errors carry hints like "Please try again in 6.05s",
// which is usually all the daily post needs to recover. Returns 0 when absent.
const RETRY_AFTER_SECONDS_RE = /try again in ([\d.]+)\s*s\b/i
const RETRY_AFTER_MILLIS_RE = /try again in ([\d.]+)\s*ms\b/i

function parseRetryAfterMs(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err)
  const millis = RETRY_AFTER_MILLIS_RE.exec(msg)
  if (millis) return Math.ceil(Number.parseFloat(millis[1]))
  const seconds = RETRY_AFTER_SECONDS_RE.exec(msg)
  if (seconds) return Math.ceil(Number.parseFloat(seconds[1]) * 1000)
  return 0
}

// Retrying the whole provider chain rescues the daily post from transient
// failures that hit every provider at once - e.g. a Gemini 503 "high demand"
// spike alongside a free-tier Groq TPM rate limit, both of which self-heal in
// seconds. We cap total wall-clock spent retrying so the run still finishes
// inside the function's maxDuration.
const MAX_GENERATION_ROUNDS = 3
const GENERATION_RETRY_DEADLINE_MS = 240_000
const GENERATION_BACKOFF_BASE_MS = 1_500
const GENERATION_BACKOFF_MAX_MS = 20_000

// Gemini first (best long-form quality on the free tier), then Groq,
// then OpenAI - whichever providers have keys configured. A provider
// outage OR a malformed/unparseable response moves on to the next
// provider instead of killing the daily post. If every provider fails in a
// pass, the whole chain is retried with backoff (honoring rate-limit hints).
export async function generateParsedJson<T>(
  prompt: string,
  options: GenerateOptions,
  // Optional content check. A parsed result that fails it is treated like a
  // failed attempt (try the next provider / next round) rather than accepted -
  // so a provider returning valid-but-empty JSON (e.g. {"markdown":""}) no
  // longer kills the daily post.
  validate?: (value: T) => boolean,
): Promise<T> {
  const startedAt = Date.now()
  const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

  const attempts: Array<{ name: string; run: () => Promise<string> }> = []
  if (process.env.GEMINI_API_KEY) {
    attempts.push({ name: "Gemini", run: () => generateWithGemini(prompt, options) })
  }
  for (const provider of [getGroqProvider(), getOpenAiProvider()]) {
    if (!provider) continue
    attempts.push({
      name: provider.name,
      run: () => generateWithOpenAICompatible(provider, prompt, options),
    })
  }
  if (attempts.length === 0) {
    throw new Error(
      "No AI providers configured. Set GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY."
    )
  }

  let failures: string[] = []
  for (let round = 0; round < MAX_GENERATION_ROUNDS; round++) {
    failures = []
    let suggestedDelayMs = 0

    for (const attempt of attempts) {
      let text: string
      try {
        text = await attempt.run()
      } catch (err) {
        failures.push(`${attempt.name}: ${message(err)}`)
        suggestedDelayMs = Math.max(suggestedDelayMs, parseRetryAfterMs(err))
        continue
      }
      const parsed = parseJsonSafely<T>(text)
      if (parsed !== null && (!validate || validate(parsed))) {
        return parsed
      }
      const reason = parsed === null ? "unparseable JSON" : "JSON that failed validation"
      const tail = text.slice(-120).replace(/\s+/g, " ")
      failures.push(`${attempt.name}: returned ${reason} (${text.length} chars, ...${tail})`)
    }

    // Every provider failed this pass. Back off and retry the whole chain,
    // waiting at least as long as any server-supplied hint - unless another
    // round would risk blowing the function's time budget.
    const elapsed = Date.now() - startedAt
    const hasTimeForAnotherRound = elapsed < GENERATION_RETRY_DEADLINE_MS
    if (round < MAX_GENERATION_ROUNDS - 1 && hasTimeForAnotherRound) {
      const backoff = Math.min(GENERATION_BACKOFF_MAX_MS, GENERATION_BACKOFF_BASE_MS * 2 ** round)
      const jitter = Math.floor(Math.random() * 500)
      await sleep(Math.max(backoff, suggestedDelayMs) + jitter)
    } else {
      break
    }
  }

  throw new Error(`All AI providers failed after ${MAX_GENERATION_ROUNDS} rounds. ${failures.join(" | ")}`)
}

const IMAGE_TOKEN_PLACEHOLDER = /\{\{\s*IMAGE\s*:[^}]*\}\}/gi

function countWords(text: string): number {
  return text
    .replace(IMAGE_TOKEN_PLACEHOLDER, " ")
    .split(/\s+/)
    .filter(Boolean).length
}

async function generateOutline(topic: string, opts: BlogGenerationOptions): Promise<BlogOutline> {
  const parsed = await generateParsedJson<Partial<BlogOutline>>(
    `${buildOutlinePrompt(topic, opts)}\n\nTOPIC: ${topic.trim()}`,
    { temperature: 0.8, maxOutputTokens: 2048 },
    (value) =>
      Boolean(value.title?.trim()) && Array.isArray(value.sections) && value.sections.length > 0
  )

  const sections = Array.isArray(parsed.sections)
    ? parsed.sections
        .filter((section): section is { heading: string; points: string[] } =>
          Boolean(section && typeof section.heading === "string")
        )
        .map((section) => ({
          heading: section.heading.trim(),
          points: Array.isArray(section.points)
            ? section.points.filter((p): p is string => typeof p === "string").map((p) => p.trim())
            : [],
        }))
        .filter((section) => section.heading)
    : []

  if (!parsed.title?.trim() || sections.length === 0) {
    throw new Error("AI outline was missing a title or sections.")
  }

  return {
    title: parsed.title.trim(),
    category: normalizeBlogCategory(parsed.category, opts.targetCategory),
    excerpt: parsed.excerpt?.trim() ?? "",
    heroImageQuery: parsed.heroImageQuery?.trim() || `${topic.trim()} india finance`,
    metaTitle: parsed.metaTitle?.trim() || parsed.title.trim(),
    metaDescription: parsed.metaDescription?.trim() || parsed.excerpt?.trim() || "",
    primaryKeyword: parsed.primaryKeyword?.trim() || "",
    secondaryKeywords: Array.isArray(parsed.secondaryKeywords)
      ? parsed.secondaryKeywords
          .filter((k): k is string => typeof k === "string")
          .map((k) => k.trim())
          .filter(Boolean)
      : [],
    keyTakeaways: Array.isArray(parsed.keyTakeaways)
      ? parsed.keyTakeaways
          .filter((k): k is string => typeof k === "string")
          .map((k) => k.trim())
          .filter(Boolean)
          .slice(0, 5)
      : [],
    sections,
  }
}

// A real draft is well over this; the floor just rejects empty/stub responses
// so the retry chain moves on to another provider instead of giving up.
const MIN_WRITER_CONTENT_CHARS = 200

async function writeArticle(topic: string, outline: BlogOutline): Promise<string> {
  const parsed = await generateParsedJson<{ markdown?: string }>(
    buildWriterPrompt(topic, outline),
    { temperature: 0.7, maxOutputTokens: 16384 },
    (value) => (value.markdown?.trim().length ?? 0) >= MIN_WRITER_CONTENT_CHARS
  )
  return parsed.markdown?.trim() ?? ""
}

async function expandArticle(topic: string, draft: string): Promise<string> {
  const parsed = await generateParsedJson<{ markdown?: string }>(
    buildExpandPrompt(topic, draft),
    { temperature: 0.7, maxOutputTokens: 16384 }
  )
  return parsed.markdown?.trim() ?? ""
}

export async function generateBlogFromTopic(
  topic: string,
  opts: BlogGenerationOptions = {}
): Promise<GeneratedBlogPost> {
  const outline = await generateOutline(topic, opts)

  let content = await writeArticle(topic, outline)
  if (!content) {
    throw new Error("AI writer returned empty content.")
  }

  // Only spend a second round-trip when the first draft is genuinely thin.
  if (countWords(content) < EXPAND_THRESHOLD_WORDS) {
    try {
      const expanded = await expandArticle(topic, content)
      if (countWords(expanded) > countWords(content)) {
        content = expanded
      }
    } catch {
      // Keep the original draft if the expand pass fails.
    }
  }

  // Resolve {{IMAGE}} tokens into real photo URLs and guarantee a minimum
  // number of inline images. Share ONE resolver so the hero and inline
  // images stay distinct and on-topic. Never let an image failure kill the post.
  let hero: { url: string; alt: string } | null = null
  try {
    const resolver = createImageResolver()
    hero = await resolveHeroImage(outline.heroImageQuery, resolver)
    content = await injectInlineImages(content, 3, resolver, topic)
  } catch {
    content = content.replace(IMAGE_TOKEN_PLACEHOLDER, "").replace(/\n{3,}/g, "\n\n")
  }

  const wordCount = countWords(content)
  if (wordCount < TARGET_MIN_WORDS) {
    console.warn(`Generated post for "${topic}" is short (${wordCount} words).`)
  }

  // The post-level keyword list = primary + secondary (deduped, non-empty).
  const keywords = Array.from(
    new Set([outline.primaryKeyword, ...outline.secondaryKeywords].map((k) => k.trim()).filter(Boolean))
  )

  return {
    title: outline.title,
    category: outline.category,
    excerpt: outline.excerpt,
    content: content.trim(),
    metaTitle: outline.metaTitle,
    metaDescription: outline.metaDescription,
    primaryKeyword: outline.primaryKeyword || undefined,
    keywords,
    heroImageUrl: hero?.url,
    heroImageAlt: hero?.alt,
  }
}

export async function generateTopicFallbacks(existingTitles: string[]): Promise<string[]> {
  const parsed = await generateParsedJson<{ topics?: unknown }>(
    `${TOPIC_FALLBACK_PROMPT}\n\nExisting titles to avoid:\n${existingTitles.join("\n")}`,
    {
      temperature: 0.9,
      maxOutputTokens: 4096,
    }
  )

  if (!Array.isArray(parsed.topics)) {
    return []
  }

  return parsed.topics
    .filter((topic): topic is string => typeof topic === "string")
    .map((topic) => topic.trim())
    .filter(Boolean)
}
