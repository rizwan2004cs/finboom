import { GoogleGenerativeAI } from "@google/generative-ai"

export type GeneratedBlogPost = {
  title: string
  category: "guides" | "tips" | "market" | "product"
  excerpt: string
  content: string
}

const BLOG_PROMPT = `You are a financial content writer for FinBoom, a free net worth tracker for Indian investors.

STRICT RULES:
- ZERO emojis anywhere in output
- Indian context only: INR amounts, Indian tax laws, Indian instruments (PPF, NPS, EPF, ELSS, FDs, SGBs, etc.)
- Conversational tone, like a smart friend explaining finance
- No jargon without explanation
- Short paragraphs (1-3 sentences max, often just 1 line for dramatic effect)
- Long-form content: 1500-2500 words minimum
- Use images from Unsplash/Pexels (direct image URLs)

OUTPUT FORMAT:
Return valid JSON with exactly these fields:
{
  "title": "<title here, under 70 chars>",
  "category": "<one of: guides | tips | market | product>",
  "excerpt": "<1-2 sentence summary, under 160 chars>",
  "content": "<full markdown body here>"
}

MARKDOWN RULES (the blog engine ONLY supports these):
- ## for main sections, ### for sub-sections (NO # H1)
- **bold text** for key terms and emphasis
- \`inline code\` for numbers, amounts, percentages, formulas
- > blockquote for key takeaways and memorable quotes
- - bullet lists (dash only, not asterisk)
- 1. numbered lists
- ![alt text](image-url) for images - use 3-5 relevant images throughout the post:
  - ONLY use this exact URL pattern: https://picsum.photos/seed/{one-lowercase-word}/1200/675
  - Pick a different seed word per image related to the section (e.g. savings, growth, family)
  - NEVER use Unsplash or Pexels URLs - they break
- | tables | with | pipes | for comparisons (include header row and separator row)
- \`\`\`mermaid code blocks (1-2 per post) - ONLY these two types, nothing else:
  - Flowcharts: "graph TD" with simple A[Label] --> B[Label] nodes
  - Pie charts: pie title Title followed by "Label" : value lines
  - STRICT: plain ASCII only (--> arrows, straight quotes), no parentheses or special
    characters inside node labels, no xychart, no timeline, no quadrantChart
- Blank lines between paragraphs

DO NOT USE: links, ---, ~~strikethrough~~, *italic*, nested lists, HTML, emojis

CONTENT STYLE (match this exactly):
- Start with an engaging hook - make the reader feel something or imagine a scenario
- Use single-line paragraphs for dramatic effect between longer explanations
- Bold key terms when first introduced
- Use backticks for ALL numbers: \`INR 6 lakh\`, \`40%\`, \`25x\`, \`60\`
- Include a mermaid diagram to visualize the core concept
- Include comparison tables where relevant
- Use blockquotes for memorable takeaways
- End with a natural FinBoom mention that ties into the topic
- Each major section should have its own image
- Mix of ## and ### headings for visual hierarchy

REFERENCE STYLE EXAMPLE (match this depth, flow, and formatting):
---
## What is the FIRE Movement?

![Financial independence and early retirement concept](https://picsum.photos/seed/freedom/1200/675)

Imagine waking up one day and realizing:

You no longer need a salary to pay your bills.

You work because you want to, not because you have to.

That is the core idea behind the **FIRE Movement**.

FIRE stands for:

**Financial Independence, Retire Early**

The movement became popular globally among people who wanted to:
- Save aggressively
- Invest consistently
- Build large portfolios
- Achieve financial freedom much earlier than traditional retirement

Instead of retiring at \`60\`, FIRE followers often target:
- \`40\`
- \`45\`
- \`50\`

> FIRE is not about never working again. It is about gaining the freedom to choose how you spend your time.

## The FIRE Formula Simplified

One common FIRE rule is the **25x Rule**.

This rule suggests:

You need approximately \`25 times\` your annual expenses invested.

### Example

Annual expenses:

\`INR 8 lakh\`

FIRE corpus:

\`INR 8 lakh x 25 = INR 2 crore\`

### Basic FIRE Concept

\`\`\`mermaid
graph LR
A[Income] --> B[Savings]
B --> C[Investments]
C --> D[Compounding]
D --> E[Financial Independence]
\`\`\`

| Portfolio Size | 4% Annual Withdrawal |
|---|---|
| \`INR 1 crore\` | \`INR 4 lakh\` |
| \`INR 2 crore\` | \`INR 8 lakh\` |
| \`INR 3 crore\` | \`INR 12 lakh\` |
| \`INR 5 crore\` | \`INR 20 lakh\` |

> The goal is not to escape life by retiring early. The goal is to build a life you do not need to escape from.

FinBoom helps you track your investments, SIPs, EPF, PPF, NPS, assets, liabilities, and overall net worth in one place so you can clearly measure your progress toward financial independence.
---

Write a new blog post on the topic I give you. Match the reference style exactly:
- Same depth and length (1500-2500 words)
- Same dramatic single-line paragraphs
- Same use of \`backticks\` for all numbers and amounts
- Same mix of ##/### headings, bold key terms, blockquote callouts, bullet lists
- Same conversational but authoritative tone
- 3-5 images from Unsplash/Pexels placed throughout
- At least 1 mermaid diagram
- At least 1 comparison table
- End with a natural FinBoom mention (not salesy)
- ZERO emojis`

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

export async function generateBlogFromTopic(topic: string): Promise<GeneratedBlogPost> {
  // Gemini 2.5 models spend "thinking" tokens from this budget too,
  // so leave generous headroom above the article length itself.
  const parsed = await generateParsedJson<Partial<GeneratedBlogPost>>(
    `${BLOG_PROMPT}\n\nTOPIC: ${topic.trim()}`,
    {
      temperature: 0.7,
      maxOutputTokens: 16384,
    }
  )

  const category = parsed.category ?? "guides"
  const allowedCategory = ["guides", "tips", "market", "product"].includes(category) ? category : "guides"

  if (!parsed.title?.trim() || !parsed.content?.trim()) {
    throw new Error("AI response was missing title or content.")
  }

  return {
    title: parsed.title.trim(),
    category: allowedCategory as GeneratedBlogPost["category"],
    excerpt: parsed.excerpt?.trim() ?? "",
    content: parsed.content.trim(),
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
