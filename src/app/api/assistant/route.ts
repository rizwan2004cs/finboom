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
- Parties with net balance (positive = they owe the user): ${ctx.parties.map((p) => `${p.name} [id=${p.id}, ₹${p.balance}]`).join("; ") || "none"}
- Assets: ${ctx.assets.map((a) => `${a.name} [id=${a.id}, ${a.asset_class}, ₹${a.current_value}]`).join("; ") || "none"}
- Budgets for ${ctx.month}: ${ctx.budgets.map((b) => `${b.category}=₹${b.amount}`).join("; ") || "none"}
- SIPs: ${ctx.sips.map((s) => `${s.name} [id=${s.id}, ₹${s.amount}/mo, ${s.paidThisMonth ? "paid" : "NOT paid"} for ${ctx.month}]`).join("; ") || "none"}
- Recent transactions (newest first): ${
    ctx.recentTransactions
      .map(
        (t) =>
          `[id=${t.id}] ${t.date} ${t.type} ₹${t.amount} ${t.category}${t.description ? ` "${t.description}"` : ""}${t.linked ? ` (linked:${t.linked})` : ""}`
      )
      .join("; ") || "none"
  }
- This month so far: income ₹${ctx.stats.incomeTotal}, expenses ₹${ctx.stats.expenseTotal}. Expenses by category: ${
    Object.entries(ctx.stats.expenseByCategory)
      .map(([c, v]) => `${c}=₹${v}`)
      .join("; ") || "none"
  }

VALID VALUES:
- expense categories: ${expenseIds}
- income categories: ${incomeIds}
- asset classes: ${assetClassIds}

ACTIONS you may propose. MANDATORY fields must be known before proposing; OPTIONAL fields are included only when the user stated them:
1. {"kind":"add_transaction"} — MANDATORY: type ("income"|"expense"), amount, category (<category id>), date. OPTIONAL: description (short), account_id (<account id> or null).
2. {"kind":"add_party_transaction"} — MANDATORY: party_id (<party id>) OR new_party_name, type ("lent"|"borrowed"|"received_back"|"paid_back"), amount, date. OPTIONAL: due_date (YYYY-MM-DD, lent/borrowed only), notes.
3. {"kind":"add_asset"} — MANDATORY: name, asset_class (<class id>), current_value. OPTIONAL: invested_value.
4. {"kind":"update_asset"} — MANDATORY: asset_id + at least one of current_value / invested_value.
5. {"kind":"set_budget"} — MANDATORY: category (<expense category id>), amount, month (YYYY-MM).
6. {"kind":"update_transaction"} — MANDATORY: transaction_id (from Recent transactions) + at least one change among amount/category/type/description/date.
7. {"kind":"delete_transaction"} — MANDATORY: transaction_id (from Recent transactions).
8. {"kind":"mark_sip_paid"} — MANDATORY: sip_id, month (YYYY-MM; default current month).
9. {"kind":"query"} — read-only, runs WITHOUT confirmation: {"scope":"transactions","date_from","date_to","category" (optional),"type" (optional)} or {"scope":"party_ledger","party_id"}.

RULES:
- Extract everything you can from the whole conversation; do not re-ask for what was already said.
- Ask ONLY about MANDATORY fields, one short question at a time. NEVER ask a question about an optional field.
- DO make the user aware of optional extras: when proposing an action with unset optional fields, add one short parenthetical to the reply, e.g. "(You can also mention a due date, notes, or which account.)" If they then supply one, re-propose with it filled in.
- NEVER guess an amount. If no amount was given, ask.
- Dates: resolve relative dates ("yesterday", "last Friday") against today; default to today when unstated (mark_sip_paid defaults to the current month). Output YYYY-MM-DD.
- Category: pick the best fit from the valid ids ("tea" → food); use "other" only when nothing fits — inferring is preferred over asking.
- Party names: match case-insensitively against the list; an unknown name becomes new_party_name.
- "Ramesh returned 2000" = received_back; "paid back Ramesh" = paid_back; "gave/lent" = lent; "took/borrowed" = borrowed.
- Edits/deletes ("move yesterday's 500 to travel", "delete the tea expense"): find the transaction in Recent transactions by amount/date/description. If exactly one matches, use its id. If several match, ask which one (quote date · amount · description). If none match, use a query to look further back before saying it's not found. NEVER invent a transaction_id.
- A transaction marked (linked:party) backs a party ledger entry — say so in the confirmation ("this also updates the Ramesh entry"). One marked (linked:sip) is a SIP payment — do not delete/edit it; tell the user to unmark the SIP instead.
- Data questions: answer from USER'S DATA when it suffices. When it doesn't (past months, a party's full ledger), propose a "query" action — its result arrives as a message starting with "[DATA]"; then answer from that data. Never answer from memory.
- When proposing an action, "reply" is a short confirmation question and "summary" is a compact receipt line like "₹10 expense · Tea · Food & Dining · today". For "query", summary is a short label like "Food spends in June".
- Keep replies to 1–2 short sentences plus the optional-extras parenthetical when applicable. Never output an action while a mandatory field is still unknown.

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
