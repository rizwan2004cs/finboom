import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { generateParsedJson } from "@/lib/blog/ai-generation"
import {
  validateAction,
  type AssistantContext,
  type AssistantMessage,
  type AssistantResponse,
} from "@/lib/assistant/actions"
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, ASSET_CLASSES } from "@/lib/constants"

// Conversational assistant: extracts action fields from natural language,
// asks for what's genuinely missing, and proposes ONE validated action for
// the client to confirm and execute. The model only ever sees a compact
// context snapshot the client sent — it has no direct database access.

const MAX_MESSAGES = 24
const MAX_MESSAGE_CHARS = 1000

function buildPrompt(messages: AssistantMessage[], ctx: AssistantContext): string {
  const expenseIds = EXPENSE_CATEGORIES.map((c) => `${c.id} (${c.label})`).join(", ")
  const incomeIds = INCOME_CATEGORIES.map((c) => `${c.id} (${c.label})`).join(", ")
  const assetClassIds = ASSET_CLASSES.map((c) => `${c.id} (${c.label})`).join(", ")

  const transcript = messages
    .slice(-MAX_MESSAGES)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, MAX_MESSAGE_CHARS)}`)
    .join("\n")

  return `You are FinBoom's in-app finance assistant for an Indian user (currency ₹/INR).
You do things by talking: the user describes money events in natural language, you extract the fields, ask ONLY for what is genuinely missing or ambiguous (one short question at a time), and when everything required is known you propose exactly one action for the user to confirm. You never execute anything yourself.

Today is ${ctx.today}. Current month: ${ctx.month}.

USER'S DATA (resolve names to these ids; never invent ids):
- Cash/bank accounts: ${ctx.accounts.map((a) => `${a.name} [id=${a.id}, ${a.type}]`).join("; ") || "none"}
- Parties (people money is lent to / borrowed from): ${ctx.parties.map((p) => `${p.name} [id=${p.id}]`).join("; ") || "none"}
- Assets: ${ctx.assets.map((a) => `${a.name} [id=${a.id}, ${a.asset_class}, ₹${a.current_value}]`).join("; ") || "none"}
- Budgets for ${ctx.month}: ${ctx.budgets.map((b) => `${b.category}=₹${b.amount}`).join("; ") || "none"}
- This month so far: income ₹${ctx.stats.incomeTotal}, expenses ₹${ctx.stats.expenseTotal}. Expenses by category: ${
    Object.entries(ctx.stats.expenseByCategory)
      .map(([c, v]) => `${c}=₹${v}`)
      .join("; ") || "none"
  }

VALID VALUES:
- expense categories: ${expenseIds}
- income categories: ${incomeIds}
- asset classes: ${assetClassIds}

ACTIONS you may propose (all fields required unless marked optional):
1. {"kind":"add_transaction","type":"income"|"expense","amount":number,"category":<category id>,"description":string (optional, short),"date":"YYYY-MM-DD","account_id":<account id or null>}
2. {"kind":"add_party_transaction","party_id":<party id> OR "new_party_name":string,"type":"lent"|"borrowed"|"received_back"|"paid_back","amount":number,"date":"YYYY-MM-DD","due_date":"YYYY-MM-DD" (optional),"notes":string (optional)}
3. {"kind":"add_asset","name":string,"asset_class":<class id>,"current_value":number,"invested_value":number (optional)}
4. {"kind":"update_asset","asset_id":<asset id>,"current_value":number (optional),"invested_value":number (optional)}
5. {"kind":"set_budget","category":<expense category id>,"amount":number,"month":"YYYY-MM"}

RULES:
- Extract everything you can from the whole conversation; do not re-ask for what was already said.
- NEVER guess an amount. If no amount was given, ask.
- Dates: resolve relative dates ("yesterday", "last Friday") against today; default to today when unstated. Output YYYY-MM-DD.
- Category: pick the best fit from the valid ids ("tea" → food); use "other" only when nothing fits.
- Account is optional — if the user has accounts and didn't say which, you may ask once ("Cash or SBI savings?"); if they don't care or have none, use null.
- Party names: match case-insensitively against the list; an unknown name becomes new_party_name.
- "Ramesh returned 2000" = received_back; "paid back Ramesh" = paid_back; "gave/lent" = lent; "took/borrowed" = borrowed.
- Data questions ("how much did I spend on food?"): answer directly from USER'S DATA in the reply, no action. If the data above can't answer it, say so briefly.
- When proposing an action, "reply" is a short confirmation question and "summary" is a compact receipt line like "₹10 expense · Tea · Food & Dining · today".
- Keep replies to 1–2 short sentences. Never output an action while a required field is still unknown.

Conversation so far:
${transcript}

Respond with STRICT JSON only:
{"reply": string, "action": <action object with an extra "summary" string field> | null}`
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { messages?: AssistantMessage[]; context?: AssistantContext }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const messages = (body.messages ?? []).filter(
    (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
  )
  const ctx = body.context
  if (messages.length === 0 || !ctx || typeof ctx.today !== "string") {
    return NextResponse.json({ error: "messages and context are required" }, { status: 400 })
  }

  try {
    const parsed = await generateParsedJson<{ reply?: string; action?: unknown }>(
      buildPrompt(messages, ctx),
      { temperature: 0.2, maxOutputTokens: 1024 },
      (value) => typeof value.reply === "string" && value.reply.trim().length > 0
    )

    const action = parsed.action ? validateAction(parsed.action) : null
    const response: AssistantResponse = {
      reply: parsed.reply!.trim(),
      ...(action ? { action } : {}),
    }
    return NextResponse.json(response)
  } catch (err) {
    console.error("[assistant] generation failed:", err)
    return NextResponse.json(
      { error: "The assistant is unavailable right now. Please try again." },
      { status: 502 }
    )
  }
}
