// Shared contract between the assistant API route and the chat UI.
//
// The model never mutates anything. It extracts fields from conversation and
// proposes ONE action; the client shows the summary for confirmation and then
// executes it through the same offline-first mutations the manual UI uses —
// so validation, sync, and Cash & Bank tagging all behave identically.

export type AssistantAction =
  | {
      kind: "add_transaction"
      type: "income" | "expense"
      amount: number
      category: string
      description?: string
      date: string
      account_id?: string | null
    }
  | {
      kind: "add_party_transaction"
      party_id?: string
      new_party_name?: string
      type: "lent" | "borrowed" | "received_back" | "paid_back"
      amount: number
      date: string
      due_date?: string
      notes?: string
    }
  | {
      kind: "add_asset"
      name: string
      asset_class: string
      current_value: number
      invested_value?: number
    }
  | {
      kind: "update_asset"
      asset_id: string
      current_value?: number
      invested_value?: number
    }
  | {
      kind: "set_budget"
      category: string
      amount: number
      month: string // YYYY-MM
    }
  | {
      kind: "update_transaction"
      transaction_id: string
      amount?: number
      category?: string
      type?: "income" | "expense"
      description?: string
      date?: string
    }
  | {
      kind: "delete_transaction"
      transaction_id: string
    }
  | {
      kind: "mark_sip_paid"
      sip_id: string
      month: string // YYYY-MM
    }
  // Read-only data request. Executed automatically (no confirmation), its
  // result is fed back to the model as a "[DATA]" message so it can answer
  // questions beyond the standing snapshot.
  | {
      kind: "query"
      scope: "transactions" | "party_ledger"
      date_from?: string
      date_to?: string
      category?: string
      type?: "income" | "expense"
      party_id?: string
    }

export type AssistantResponse = {
  reply: string
  // Present only when every required field is known; `summary` is the
  // one-line human confirmation ("Add ₹10 expense · Tea · Cash · today").
  action?: AssistantAction & { summary: string }
}

export type AssistantMessage = { role: "user" | "assistant"; content: string }

// Context snapshot the client sends with each request so the model can
// ground names → ids and answer data questions. Ids stay server-side only
// long enough to build the prompt; nothing is stored.
export type AssistantContext = {
  today: string // YYYY-MM-DD
  month: string // YYYY-MM
  accounts: Array<{ id: string; name: string; type: string }>
  parties: Array<{ id: string; name: string; balance: number }>
  assets: Array<{ id: string; name: string; asset_class: string; current_value: number }>
  budgets: Array<{ category: string; amount: number }>
  sips: Array<{ id: string; name: string; amount: number; paidThisMonth: boolean }>
  // Newest first — lets the model resolve "yesterday's 500" to a real id.
  // `linked` marks transactions backing a party entry or SIP payment, whose
  // edits/deletes carry extra logic.
  recentTransactions: Array<{
    id: string
    type: "income" | "expense"
    amount: number
    category: string
    description?: string
    date: string
    linked?: "party" | "sip"
  }>
  stats: {
    incomeTotal: number
    expenseTotal: number
    expenseByCategory: Record<string, number>
  }
}

const MAX_AMOUNT = 1_000_000_000_000
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ISO_MONTH = /^\d{4}-\d{2}$/

function validAmount(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0 && n <= MAX_AMOUNT
}

// Sanity-check a model-proposed action. Returns null when anything about it
// is off — the caller then keeps the reply text but drops the action, so a
// hallucinated field can never reach the database.
export function validateAction(raw: unknown): (AssistantAction & { summary: string }) | null {
  if (!raw || typeof raw !== "object") return null
  const a = raw as Record<string, unknown>
  if (typeof a.summary !== "string" || !a.summary.trim()) return null

  switch (a.kind) {
    case "add_transaction":
      if ((a.type !== "income" && a.type !== "expense") || !validAmount(a.amount)) return null
      if (typeof a.category !== "string" || !a.category) return null
      if (typeof a.date !== "string" || !ISO_DATE.test(a.date)) return null
      return a as AssistantAction & { summary: string }
    case "add_party_transaction": {
      const types = ["lent", "borrowed", "received_back", "paid_back"]
      if (!types.includes(a.type as string) || !validAmount(a.amount)) return null
      if (typeof a.date !== "string" || !ISO_DATE.test(a.date)) return null
      if (!a.party_id && !(typeof a.new_party_name === "string" && a.new_party_name.trim())) return null
      if (a.due_date && (typeof a.due_date !== "string" || !ISO_DATE.test(a.due_date))) return null
      return a as AssistantAction & { summary: string }
    }
    case "add_asset":
      if (typeof a.name !== "string" || !a.name.trim() || !validAmount(a.current_value)) return null
      if (typeof a.asset_class !== "string" || !a.asset_class) return null
      return a as AssistantAction & { summary: string }
    case "update_asset":
      if (typeof a.asset_id !== "string" || !a.asset_id) return null
      if (a.current_value === undefined && a.invested_value === undefined) return null
      if (a.current_value !== undefined && !validAmount(a.current_value)) return null
      if (a.invested_value !== undefined && !validAmount(a.invested_value)) return null
      return a as AssistantAction & { summary: string }
    case "set_budget":
      if (typeof a.category !== "string" || !a.category || !validAmount(a.amount)) return null
      if (typeof a.month !== "string" || !ISO_MONTH.test(a.month)) return null
      return a as AssistantAction & { summary: string }
    case "update_transaction": {
      if (typeof a.transaction_id !== "string" || !a.transaction_id) return null
      const hasChange =
        a.amount !== undefined ||
        a.category !== undefined ||
        a.type !== undefined ||
        a.description !== undefined ||
        a.date !== undefined
      if (!hasChange) return null
      if (a.amount !== undefined && !validAmount(a.amount)) return null
      if (a.type !== undefined && a.type !== "income" && a.type !== "expense") return null
      if (a.date !== undefined && (typeof a.date !== "string" || !ISO_DATE.test(a.date))) return null
      return a as AssistantAction & { summary: string }
    }
    case "delete_transaction":
      if (typeof a.transaction_id !== "string" || !a.transaction_id) return null
      return a as AssistantAction & { summary: string }
    case "mark_sip_paid":
      if (typeof a.sip_id !== "string" || !a.sip_id) return null
      if (typeof a.month !== "string" || !ISO_MONTH.test(a.month)) return null
      return a as AssistantAction & { summary: string }
    case "query":
      if (a.scope !== "transactions" && a.scope !== "party_ledger") return null
      if (a.scope === "party_ledger" && (typeof a.party_id !== "string" || !a.party_id)) return null
      if (a.date_from !== undefined && (typeof a.date_from !== "string" || !ISO_DATE.test(a.date_from))) return null
      if (a.date_to !== undefined && (typeof a.date_to !== "string" || !ISO_DATE.test(a.date_to))) return null
      return a as AssistantAction & { summary: string }
    default:
      return null
  }
}
