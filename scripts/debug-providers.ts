// Probes each AI provider directly with the real blog-sized prompt and
// reports finish reasons + whether output parses. Publishes nothing.
// Usage: npx -y tsx --env-file=.env.local scripts/debug-providers.ts
import { GoogleGenerativeAI } from "@google/generative-ai"

const PROMPT = `Return valid JSON: {"title": "...", "category": "guides", "excerpt": "...", "content": "<markdown>"}.
Write a 1500-word blog post for Indian investors about emergency funds. Markdown in "content" with ## headings, **bold**, \`numbers\`. ZERO emojis.`

function parseable(text: string) {
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

async function probeGemini(model: string) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const m = genAI.getGenerativeModel({ model })
  try {
    const result = await m.generateContent({
      contents: [{ role: "user", parts: [{ text: PROMPT }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 16384,
        responseMimeType: "application/json",
        ...({ thinkingConfig: { thinkingBudget: 0 } } as Record<string, unknown>),
      },
    })
    const text = result.response.text()
    const finish = result.response.candidates?.[0]?.finishReason
    console.log(
      `Gemini ${model}: finish=${finish} chars=${text.length} parses=${parseable(text)} tail=${JSON.stringify(text.slice(-60))}`
    )
  } catch (e) {
    console.log(`Gemini ${model}: ERROR ${(e as Error).message.slice(0, 140)}`)
  }
}

async function probeGroq(model: string) {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: PROMPT }],
        temperature: 0.7,
        max_tokens: 16384,
        response_format: { type: "json_object" },
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      console.log(`Groq ${model}: HTTP ${res.status} ${data.error?.message?.slice(0, 120)}`)
      return
    }
    const text = data.choices?.[0]?.message?.content ?? ""
    console.log(
      `Groq ${model}: finish=${data.choices?.[0]?.finish_reason} chars=${text.length} parses=${parseable(text)} tail=${JSON.stringify(text.slice(-60))}`
    )
  } catch (e) {
    console.log(`Groq ${model}: ERROR ${(e as Error).message.slice(0, 140)}`)
  }
}

async function main() {
  await probeGemini("gemini-2.5-flash")
  await probeGroq("llama-3.3-70b-versatile")
}

main()
