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
  - Unsplash: https://images.unsplash.com/photo-{id} (use real popular finance/lifestyle photo IDs)
  - Pexels: https://images.pexels.com/photos/{id}/pexels-photo-{id}.jpeg
- | tables | with | pipes | for comparisons (include header row and separator row)
- \`\`\`mermaid code blocks - use generously to visualize concepts:
  - Flowcharts: graph TD / graph LR
  - Pie charts: pie title "Title"
  - Bar charts: xychart-beta (x-axis, y-axis, bar, line)
  - Timelines: timeline
  - Quadrant charts: quadrantChart
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

![Financial independence and early retirement concept](https://images.unsplash.com/photo-1579621970795-87facc2f976d)

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

function parseJsonSafely<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    try {
      return JSON.parse(jsonMatch[0]) as T
    } catch {
      return null
    }
  }
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

function getGeminiClient(modelName: string) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.")
  }
  const genAI = new GoogleGenerativeAI(apiKey)
  return genAI.getGenerativeModel({ model: modelName })
}

function isModelUnavailableError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  return /\b(429|404|quota|not found|RESOURCE_EXHAUSTED)\b/i.test(message)
}

type GenerateRequest = Parameters<ReturnType<typeof getGeminiClient>["generateContent"]>[0]

async function generateWithFallback(request: GenerateRequest) {
  let lastError: unknown = null
  for (const modelName of GEMINI_MODELS) {
    try {
      const model = getGeminiClient(modelName)
      return await model.generateContent(request)
    } catch (err) {
      lastError = err
      if (!isModelUnavailableError(err)) throw err
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("All Gemini models failed or are over quota.")
}

export async function generateBlogFromTopic(topic: string): Promise<GeneratedBlogPost> {
  const result = await generateWithFallback({
    contents: [
      {
        role: "user",
        parts: [{ text: `${BLOG_PROMPT}\n\nTOPIC: ${topic.trim()}` }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      // Gemini 2.5 models spend "thinking" tokens from this budget too,
      // so leave generous headroom above the article length itself.
      maxOutputTokens: 16384,
      responseMimeType: "application/json",
    },
  })

  const parsed = parseJsonSafely<Partial<GeneratedBlogPost>>(result.response.text())
  if (!parsed) {
    throw new Error("Failed to parse AI response.")
  }

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
  const result = await generateWithFallback({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${TOPIC_FALLBACK_PROMPT}\n\nExisting titles to avoid:\n${existingTitles.join("\n")}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    },
  })

  const parsed = parseJsonSafely<{ topics?: unknown }>(result.response.text())
  if (!parsed || !Array.isArray(parsed.topics)) {
    return []
  }

  return parsed.topics
    .filter((topic): topic is string => typeof topic === "string")
    .map((topic) => topic.trim())
    .filter(Boolean)
}
