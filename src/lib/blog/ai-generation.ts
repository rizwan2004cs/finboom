import { GoogleGenerativeAI } from "@google/generative-ai"
import { injectInlineImages, resolveHeroImage } from "@/lib/blog/images"

export type GeneratedBlogPost = {
  title: string
  category: "guides" | "tips" | "market" | "product"
  excerpt: string
  content: string
  heroImageUrl?: string
  heroImageAlt?: string
}

type BlogOutline = {
  title: string
  category: GeneratedBlogPost["category"]
  excerpt: string
  heroImageQuery: string
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

const OUTLINE_PROMPT = `You are the editor for FinBoom, a free net worth tracker for Indian investors.

Plan a long-form blog post on the topic given below. Return ONLY valid JSON:
{
  "title": "<compelling title, under 70 chars, no emojis>",
  "category": "<one of: guides | tips | market | product>",
  "excerpt": "<1-2 sentence summary, under 160 chars>",
  "heroImageQuery": "<2-4 word photo search query for the hero image, e.g. 'indian family budgeting'>",
  "sections": [
    {
      "heading": "<section heading, no numbering>",
      "points": ["<specific point to cover>", "<another concrete point>"]
    }
  ]
}

RULES:
- 7 to 9 sections that flow logically from hook to conclusion
- First section is an engaging hook; last section ties back to FinBoom
- Each section needs 3-5 concrete, non-overlapping points
- Indian context only: INR amounts, Indian tax laws, Indian instruments (PPF, NPS, EPF, ELSS, FDs, SGBs, mutual funds, SIPs)
- Cover the topic with real depth: definitions, examples with numbers, comparisons, common mistakes, actionable steps
- Zero emojis`

// Shared formatting contract for both the writer and expand passes.
const MARKDOWN_RULES = `MARKDOWN RULES (the blog engine ONLY supports these):
- ## for main sections, ### for sub-sections (NO # H1)
- **bold text** for key terms and emphasis
- \`inline code\` for ALL numbers, amounts, percentages, formulas: \`INR 6 lakh\`, \`40%\`, \`25x\`, \`60\`
- > blockquote for key takeaways and memorable quotes
- - bullet lists (dash only, not asterisk)
- 1. numbered lists
- | tables | with | pipes | for comparisons (include a header row and a |---|---| separator row) - at least one table
- \`\`\`mermaid code blocks - EXACTLY ONE per post - ONLY these two types:
  - Flowcharts: "graph TD" or "graph LR" with simple A[Label] --> B[Label] nodes
  - Pie charts: pie title Title followed by "Label" : value lines
  - STRICT: plain ASCII only (--> arrows, straight quotes), no parentheses or special
    characters inside node labels, no other diagram types
- Blank lines between paragraphs

IMAGES: do NOT write any image markdown or URLs. Instead, immediately after 3 to 4 of the
\`##\` section headings, put an image placeholder on its own line in this exact form:
{{IMAGE: 2-4 word visual search query}}
Make each query concrete and visual (e.g. {{IMAGE: indian rupee coins}}, {{IMAGE: stock market chart}}).

DO NOT USE: image URLs, links, ---, ~~strikethrough~~, *italic*, nested lists, HTML, emojis

STYLE:
- Start with an engaging hook that makes the reader feel something or imagine a scenario
- Short paragraphs (1-3 sentences), often a single line for dramatic effect
- Bold key terms when first introduced
- Use blockquotes for memorable takeaways
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

  return `You are a financial content writer for FinBoom, a free net worth tracker for Indian investors.

Write the FULL blog post body in markdown for this topic: "${topic}"

Follow this section plan in order, using each heading as a \`##\` section and expanding every
point into rich, specific prose (aim for 250-400 words per section):

${sectionPlan}

Write 1800-2800 words total. Do not skip sections. Add depth with concrete Indian examples and
real numbers in backticks.

${MARKDOWN_RULES}

Return ONLY valid JSON: { "markdown": "<full markdown body>" }`
}

function buildExpandPrompt(topic: string, draft: string): string {
  return `You are an editor for FinBoom. The following draft blog post on "${topic}" is too short and
thin. Rewrite it to be noticeably longer and more valuable: expand each section with more
explanation, concrete Indian examples, and numbers in backticks. Keep every \`##\` heading, keep
the {{IMAGE: ...}} placeholders, keep the existing mermaid diagram and tables. Target 2000+ words.

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
- Topics must fit FinBoom: Indian investing, wealth building, budgeting, taxation, retirement, insurance
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

type GenerateOptions = {
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

// Gemini first (best long-form quality on the free tier), then Groq,
// then OpenAI - whichever providers have keys configured. A provider
// outage OR a malformed/unparseable response moves on to the next
// provider instead of killing the daily post.
async function generateParsedJson<T>(prompt: string, options: GenerateOptions): Promise<T> {
  const failures: string[] = []
  const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

  const attempts: Array<{ name: string; run: () => Promise<string> }> = []
  if (process.env.GEMINI_API_KEY) {
    attempts.push({ name: "Gemini", run: () => generateWithGemini(prompt, options) })
  } else {
    failures.push("Gemini: key not configured")
  }
  for (const provider of [getGroqProvider(), getOpenAiProvider()]) {
    if (!provider) continue
    attempts.push({
      name: provider.name,
      run: () => generateWithOpenAICompatible(provider, prompt, options),
    })
  }

  for (const attempt of attempts) {
    let text: string
    try {
      text = await attempt.run()
    } catch (err) {
      failures.push(`${attempt.name}: ${message(err)}`)
      continue
    }
    const parsed = parseJsonSafely<T>(text)
    if (parsed !== null) {
      return parsed
    }
    const tail = text.slice(-120).replace(/\s+/g, " ")
    failures.push(`${attempt.name}: returned unparseable JSON (${text.length} chars, ...${tail})`)
  }

  throw new Error(`All AI providers failed. ${failures.join(" | ")}`)
}

const IMAGE_TOKEN_PLACEHOLDER = /\{\{\s*IMAGE\s*:[^}]*\}\}/gi

function countWords(text: string): number {
  return text
    .replace(IMAGE_TOKEN_PLACEHOLDER, " ")
    .split(/\s+/)
    .filter(Boolean).length
}

function normalizeCategory(value: unknown): GeneratedBlogPost["category"] {
  const category = typeof value === "string" ? value : "guides"
  return (["guides", "tips", "market", "product"].includes(category) ? category : "guides") as GeneratedBlogPost["category"]
}

async function generateOutline(topic: string): Promise<BlogOutline> {
  const parsed = await generateParsedJson<Partial<BlogOutline>>(
    `${OUTLINE_PROMPT}\n\nTOPIC: ${topic.trim()}`,
    { temperature: 0.8, maxOutputTokens: 2048 }
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
    category: normalizeCategory(parsed.category),
    excerpt: parsed.excerpt?.trim() ?? "",
    heroImageQuery: parsed.heroImageQuery?.trim() || `${topic.trim()} india finance`,
    sections,
  }
}

async function writeArticle(topic: string, outline: BlogOutline): Promise<string> {
  const parsed = await generateParsedJson<{ markdown?: string }>(
    buildWriterPrompt(topic, outline),
    { temperature: 0.7, maxOutputTokens: 16384 }
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

export async function generateBlogFromTopic(topic: string): Promise<GeneratedBlogPost> {
  const outline = await generateOutline(topic)

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
  // number of inline images. Never let an image failure kill the post.
  let hero: { url: string; alt: string } | null = null
  try {
    content = await injectInlineImages(content, 3)
    hero = await resolveHeroImage(outline.heroImageQuery)
  } catch {
    content = content.replace(IMAGE_TOKEN_PLACEHOLDER, "").replace(/\n{3,}/g, "\n\n")
  }

  const wordCount = countWords(content)
  if (wordCount < TARGET_MIN_WORDS) {
    console.warn(`Generated post for "${topic}" is short (${wordCount} words).`)
  }

  return {
    title: outline.title,
    category: outline.category,
    excerpt: outline.excerpt,
    content: content.trim(),
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
