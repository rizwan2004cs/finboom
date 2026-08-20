"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useUser } from "@/hooks/use-auth"
import { useProfile } from "@/hooks/use-profile"
import { fetchTable, insertRow, updateRow, deleteRow } from "@/lib/offline"
import { accountBalance } from "@/lib/finance/accounts"
import { getPreferredAccountId } from "@/lib/accounts/default-account"
import { todayLocalISO } from "@/lib/utils"
import type {
  Account,
  Asset,
  Budget,
  Party,
  PartyTransaction,
  Sip,
  SipPayment,
  Transaction,
} from "@/lib/types"
import type {
  AssistantAction,
  AssistantContext,
  AssistantMessage,
  AssistantResponse,
} from "@/lib/assistant/actions"
import { Sparkles, X, Send, Loader2, Check, Undo2, Plus, History, Trash2 } from "lucide-react"

// In-app AI assistant: type "I spent 10 rs for tea" → the model extracts the
// fields (asking only for what's missing), proposes one action, and after an
// explicit Confirm the CLIENT executes it through the same offline-first
// mutations the manual modals use. Every receipt has Undo.

type UndoPlan =
  | { type: "delete"; rows: Array<{ table: string; id: string }> }
  | { type: "revert"; targets: Array<{ table: string; id: string; prev: Record<string, unknown> }> }
  | { type: "restore"; rows: Array<{ table: string; row: Record<string, unknown> }> }
  | { type: "sip_unmark"; paymentId: string }

type ChatMessage = AssistantMessage & {
  id: string
  receipt?: string
  undo?: UndoPlan
  undone?: boolean
  // "[DATA] …" query results: sent to the model, never rendered.
  hidden?: boolean
  // Quick-reply chips for multiple-choice questions.
  options?: string[]
}

type ChatSession = { id: string; title: string; createdAt: string; messages: ChatMessage[] }

type PendingAction = AssistantAction & { summary: string }

const HISTORY_LIMIT = 40
const SESSION_LIMIT = 15

export function AssistantChat() {
  const { user } = useUser()
  const { activeProfile } = useProfile()
  const queryClient = useQueryClient()

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [sessionList, setSessionList] = useState<ChatSession[] | null>(null) // non-null = list view open
  const listRef = useRef<HTMLDivElement>(null)
  const sessionsKey =
    user && activeProfile ? `finboom_assistant_sessions_${user.id}_${activeProfile.id}` : null

  const readSessions = useCallback((): ChatSession[] => {
    if (!sessionsKey) return []
    try {
      return JSON.parse(localStorage.getItem(sessionsKey) ?? "[]") as ChatSession[]
    } catch {
      return []
    }
  }, [sessionsKey])

  const writeSessions = useCallback(
    (list: ChatSession[]) => {
      if (!sessionsKey) return
      try {
        localStorage.setItem(sessionsKey, JSON.stringify(list.slice(0, SESSION_LIMIT)))
      } catch {
        /* storage unavailable */
      }
    },
    [sessionsKey]
  )

  // Restore the most recent session per profile (migrating the pre-sessions
  // single-thread history into a session on first run). Depend ONLY on the
  // stable storage key — depending on the user/profile objects re-ran this on
  // every provider re-render, resetting the session list & new-chat state the
  // moment the header buttons changed them.
  useEffect(() => {
    if (!sessionsKey) return
    let list = readSessions()
    try {
      const legacyKey = sessionsKey.replace("finboom_assistant_sessions_", "finboom_assistant_")
      const legacy = localStorage.getItem(legacyKey)
      if (list.length === 0 && legacy) {
        const msgs = JSON.parse(legacy) as ChatMessage[]
        if (msgs.length > 0) {
          list = [
            {
              id: crypto.randomUUID(),
              title: (msgs.find((m) => m.role === "user")?.content ?? "Chat").slice(0, 48),
              createdAt: new Date().toISOString(),
              messages: msgs,
            },
          ]
          writeSessions(list)
        }
        localStorage.removeItem(legacyKey)
      }
    } catch {
      /* malformed legacy history */
    }
    const latest = list[0]
    setActiveSessionId(latest?.id ?? crypto.randomUUID())
    setMessages(latest?.messages ?? [])
    setPending(null)
    setSessionList(null)
  }, [sessionsKey, readSessions, writeSessions])

  // Persist the active session (created lazily on its first message).
  useEffect(() => {
    if (!sessionsKey || !activeSessionId || messages.length === 0) return
    const list = readSessions()
    const idx = list.findIndex((s) => s.id === activeSessionId)
    const entry: ChatSession = {
      id: activeSessionId,
      title: (messages.find((m) => m.role === "user" && !m.hidden)?.content ?? "Chat").slice(0, 48),
      createdAt: idx >= 0 ? list[idx].createdAt : new Date().toISOString(),
      messages: messages.slice(-HISTORY_LIMIT),
    }
    if (idx >= 0) list[idx] = entry
    else list.unshift(entry)
    writeSessions(list)
  }, [messages, activeSessionId, sessionsKey, readSessions, writeSessions])

  function startNewChat() {
    setActiveSessionId(crypto.randomUUID())
    setMessages([])
    setPending(null)
    setSessionList(null)
  }

  function openSession(s: ChatSession) {
    setActiveSessionId(s.id)
    setMessages(s.messages)
    setPending(null)
    setSessionList(null)
  }

  function deleteSession(id: string) {
    const list = readSessions().filter((s) => s.id !== id)
    writeSessions(list)
    setSessionList(list)
    if (id === activeSessionId) {
      setActiveSessionId(crypto.randomUUID())
      setMessages([])
      setPending(null)
    }
  }

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, pending, busy, open])

  const buildContext = useCallback(async (): Promise<AssistantContext> => {
    const uid = user!.id
    const pid = activeProfile!.id
    const today = todayLocalISO()
    const month = today.slice(0, 7)
    // All transactions in one fetch: account balances need the full history,
    // and recent/month slices derive from it.
    const [accounts, parties, assets, budgets, allTx, partyTx, sips, sipPayments] =
      await Promise.all([
        fetchTable<Account>("accounts", uid),
        fetchTable<Party>("parties", uid),
        fetchTable<Asset>("assets", uid),
        fetchTable<Budget>("budgets", uid, {
          filters: [{ column: "month", op: "eq", value: month }],
        }),
        fetchTable<Transaction>("transactions", uid),
        fetchTable<PartyTransaction>("party_transactions", uid),
        fetchTable<Sip>("sips", uid),
        fetch("/api/sip-payments")
          .then((r) => r.json())
          .then((d) => (d.payments ?? []) as SipPayment[])
          .catch(() => [] as SipPayment[]),
      ])

    const profileTx = allTx.filter((t) => t.profile_id === pid)
    const monthTx = profileTx.filter((t) => t.date >= `${month}-01`)
    const expenseByCategory: Record<string, number> = {}
    let incomeTotal = 0
    let expenseTotal = 0
    for (const t of monthTx) {
      const amt = Number(t.amount)
      if (t.type === "income") incomeTotal += amt
      else {
        expenseTotal += amt
        expenseByCategory[t.category] = (expenseByCategory[t.category] ?? 0) + amt
      }
    }

    // Net balance per party: what they still owe (positive) or are owed.
    const balanceByParty = new Map<string, number>()
    for (const t of partyTx) {
      const amt = Number(t.amount)
      const sign = t.type === "lent" ? 1 : t.type === "received_back" ? -1 : t.type === "borrowed" ? -1 : 1
      balanceByParty.set(t.party_id, (balanceByParty.get(t.party_id) ?? 0) + sign * amt)
    }

    // Transactions backing a party entry or SIP payment carry extra logic on
    // edit/delete — flag them so the model warns instead of breaking links.
    const partyLinkedTx = new Set(partyTx.map((t) => t.linked_transaction_id).filter(Boolean))
    const sipLinkedTx = new Set(sipPayments.map((p) => p.transaction_id).filter(Boolean))
    const paidSips = new Set(sipPayments.filter((p) => p.month === month).map((p) => p.sip_id))

    return {
      today,
      month,
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        balance: accountBalance(a, allTx),
      })),
      // Primary (starred) account wins; else the last one used on this profile.
      defaultAccountId: (() => {
        const preferred = getPreferredAccountId(pid)
        return preferred && accounts.some((a) => a.id === preferred) ? preferred : undefined
      })(),
      parties: parties.map((p) => ({
        id: p.id,
        name: p.name,
        balance: balanceByParty.get(p.id) ?? 0,
      })),
      assets: assets
        .filter((a) => a.profile_id === pid)
        .map((a) => ({
          id: a.id,
          name: a.name,
          asset_class: a.asset_class,
          current_value: Number(a.current_value),
        })),
      budgets: budgets
        .filter((b) => b.profile_id === pid)
        .map((b) => ({ category: b.category, amount: Number(b.amount) })),
      sips: sips
        .filter((s) => s.profile_id === pid && s.active)
        .map((s) => ({
          id: s.id,
          name: s.name,
          amount: Number(s.amount),
          paidThisMonth: paidSips.has(s.id),
        })),
      recentTransactions: [...profileTx]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 25)
        .map((t) => ({
          id: t.id,
          type: t.type,
          amount: Number(t.amount),
          category: t.category,
          description: t.description || undefined,
          date: t.date,
          ...(partyLinkedTx.has(t.id)
            ? { linked: "party" as const }
            : sipLinkedTx.has(t.id)
              ? { linked: "sip" as const }
              : {}),
        })),
      stats: {
        incomeTotal,
        expenseTotal,
        expenseByCategory,
        totalAssetValue: assets
          .filter((a) => a.profile_id === pid)
          .reduce((s, a) => s + Number(a.current_value), 0),
        totalAccountBalance: accounts.reduce((s, a) => s + accountBalance(a, allTx), 0),
      },
    }
  }, [user, activeProfile])

  // Read-only lookups the model can request beyond the standing snapshot.
  // Results go back as a hidden "[DATA]" message; never needs confirmation.
  async function runQuery(q: Extract<AssistantAction, { kind: "query" }>): Promise<unknown> {
    const uid = user!.id
    const pid = activeProfile!.id
    if (q.scope === "party_ledger") {
      const txs = await fetchTable<PartyTransaction>("party_transactions", uid, {
        filters: [{ column: "party_id", op: "eq", value: q.party_id! }],
      })
      let netOwedToUser = 0
      const entries = [...txs]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((t) => {
          const amt = Number(t.amount)
          netOwedToUser +=
            t.type === "lent" ? amt : t.type === "received_back" ? -amt : t.type === "borrowed" ? -amt : amt
          return { date: t.date, type: t.type, amount: amt, due_date: t.due_date ?? null }
        })
      return { scope: "party_ledger", netOwedToUser, entries: entries.slice(-20) }
    }
    const today = todayLocalISO()
    const from = q.date_from ?? `${Number(today.slice(0, 4)) - 1}${today.slice(4, 10)}`
    const to = q.date_to ?? today
    const txs = await fetchTable<Transaction>("transactions", uid, {
      filters: [
        { column: "date", op: "gte", value: from },
        { column: "date", op: "lte", value: to },
      ],
    })
    const matched = txs.filter(
      (t) =>
        t.profile_id === pid &&
        (!q.category || t.category === q.category) &&
        (!q.type || t.type === q.type)
    )
    const byCategory: Record<string, number> = {}
    let total = 0
    for (const t of matched) {
      total += Number(t.amount)
      byCategory[t.category] = (byCategory[t.category] ?? 0) + Number(t.amount)
    }
    const sample = [...matched]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10)
      .map((t) => ({
        id: t.id,
        date: t.date,
        type: t.type,
        amount: Number(t.amount),
        category: t.category,
        description: t.description ?? null,
      }))
    return { scope: "transactions", from, to, count: matched.length, total, byCategory, sample }
  }

  // One model round-trip; auto-runs read-only queries and feeds the result
  // back (max 2 rounds) so "spends on food in June" works without confirms.
  async function converse(history: ChatMessage[], depth: number): Promise<void> {
    const context = await buildContext()
    const res = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: history.map(({ role, content }) => ({ role, content })),
        context,
      }),
    })
    const data = (await res.json()) as AssistantResponse & { error?: string }
    if (!res.ok) throw new Error(data.error || "Request failed")

    if (data.action?.kind === "query" && depth < 2) {
      const result = await runQuery(data.action)
      const dataMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: `[DATA] ${JSON.stringify(result)}`,
        hidden: true,
      }
      setMessages((prev) => [...prev, dataMsg])
      await converse([...history, dataMsg], depth + 1)
      return
    }

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply,
        ...(data.options?.length ? { options: data.options } : {}),
      },
    ])
    if (data.action && data.action.kind !== "query") setPending(data.action)
  }

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim()
    if (!text || busy || !user || !activeProfile) return
    setInput("")
    setPending(null)
    const next: ChatMessage[] = [...messages, { id: crypto.randomUUID(), role: "user", content: text }]
    setMessages(next)
    setBusy(true)
    try {
      await converse(next, 0)
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: err instanceof Error ? err.message : "Something went wrong. Please try again.",
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  // Executes a confirmed action through the SAME offline-layer calls the
  // manual modals make, and returns the receipt + undo plan.
  async function execute(action: PendingAction): Promise<{ receipt: string; undo: UndoPlan }> {
    const uid = user!.id
    const pid = activeProfile!.id

    if (action.kind === "add_transaction") {
      // Overdraft guard: an expense from a tracked account can't exceed its
      // balance (mirrors the manual modal's check).
      if (action.type === "expense" && action.account_id) {
        const [accounts, allTx] = await Promise.all([
          fetchTable<Account>("accounts", uid),
          fetchTable<Transaction>("transactions", uid),
        ])
        const account = accounts.find((a) => a.id === action.account_id)
        if (account) {
          const balance = accountBalance(account, allTx)
          if (balance < action.amount) {
            throw new Error(
              `${account.name} has only ₹${balance.toLocaleString("en-IN")} — this ₹${action.amount.toLocaleString("en-IN")} expense would overdraw it. Pick another account or leave it untracked.`
            )
          }
        }
      }
      const { data, error } = await insertRow<{ id: string }>("transactions", {
        user_id: uid,
        profile_id: pid,
        type: action.type,
        category: action.category,
        amount: action.amount,
        description: action.description || null,
        date: action.date,
        currency: "INR",
        account_id: action.account_id ?? null,
      })
      if (error || !data) throw new Error(error || "Insert failed")
      // Refresh the per-profile default source, same as the manual modal.
      if (action.account_id) {
        try {
          localStorage.setItem(`finboom_last_account_${pid}`, action.account_id)
        } catch {
          /* storage unavailable */
        }
      }
      return {
        receipt: `Added ${action.summary}`,
        undo: { type: "delete", rows: [{ table: "transactions", id: data.id }] },
      }
    }

    if (action.kind === "add_party_transaction") {
      let partyId = action.party_id
      const created: Array<{ table: string; id: string }> = []
      let partyName = ""
      if (!partyId) {
        const { data, error } = await insertRow<{ id: string }>("parties", {
          user_id: uid,
          name: action.new_party_name!.trim(),
        })
        if (error || !data) throw new Error(error || "Could not create party")
        partyId = data.id
        partyName = action.new_party_name!.trim()
        created.push({ table: "parties", id: data.id })
      }
      const { data: pt, error: ptError } = await insertRow<{ id: string }>("party_transactions", {
        user_id: uid,
        party_id: partyId,
        type: action.type,
        amount: action.amount,
        currency: "INR",
        date: action.date,
        due_date: action.due_date || null,
        notes: action.notes || null,
      })
      if (ptError || !pt) throw new Error(ptError || "Insert failed")
      created.push({ table: "party_transactions", id: pt.id })

      // Mirror the manual modal: auto-create the linked income/expense so
      // cash-flow views stay consistent.
      const moneyOut = action.type === "lent" || action.type === "paid_back"
      const name = partyName || "party"
      const descriptions = {
        received_back: `Received back from ${name}`,
        paid_back: `Paid back to ${name}`,
        lent: `Lent to ${name}`,
        borrowed: `Borrowed from ${name}`,
      }
      const { data: tx } = await insertRow<{ id: string }>("transactions", {
        user_id: uid,
        profile_id: pid,
        type: moneyOut ? "expense" : "income",
        category: "other",
        amount: action.amount,
        description: descriptions[action.type],
        date: action.date,
        currency: "INR",
        account_id: null,
      })
      if (tx) {
        created.push({ table: "transactions", id: tx.id })
        await updateRow("party_transactions", pt.id, { linked_transaction_id: tx.id })
      }
      return {
        receipt: `Recorded ${action.summary}`,
        undo: { type: "delete", rows: created.reverse() },
      }
    }

    if (action.kind === "add_asset") {
      const { data, error } = await insertRow<{ id: string }>("assets", {
        user_id: uid,
        profile_id: pid,
        name: action.name.trim(),
        asset_class: action.asset_class,
        current_value: action.current_value,
        invested_value: action.invested_value ?? action.current_value,
        currency: "INR",
      })
      if (error || !data) throw new Error(error || "Insert failed")
      return {
        receipt: `Added ${action.summary}`,
        undo: { type: "delete", rows: [{ table: "assets", id: data.id }] },
      }
    }

    if (action.kind === "update_asset") {
      const assets = await fetchTable<Asset>("assets", uid)
      const current = assets.find((a) => a.id === action.asset_id)
      if (!current) throw new Error("That asset no longer exists.")
      const patch: Record<string, unknown> = {}
      if (action.current_value !== undefined) patch.current_value = action.current_value
      if (action.invested_value !== undefined) patch.invested_value = action.invested_value
      const { error } = await updateRow("assets", action.asset_id, patch)
      if (error) throw new Error(error)
      return {
        receipt: `Updated ${action.summary}`,
        undo: {
          type: "revert",
          targets: [
            {
              table: "assets",
              id: action.asset_id,
              prev: {
                current_value: Number(current.current_value),
                invested_value: Number(current.invested_value),
              },
            },
          ],
        },
      }
    }

    if (action.kind === "update_transaction" || action.kind === "delete_transaction") {
      const rows = await fetchTable<Transaction>("transactions", uid, {
        filters: [{ column: "id", op: "eq", value: action.transaction_id }],
      })
      const current = rows[0]
      if (!current) throw new Error("That transaction no longer exists.")

      // A SIP payment's expense is managed by the SIP flow — editing or
      // deleting it directly would leave the sip_payments row dangling.
      const sipPayments = await fetch("/api/sip-payments")
        .then((r) => r.json())
        .then((d) => (d.payments ?? []) as SipPayment[])
        .catch(() => [] as SipPayment[])
      if (sipPayments.some((p) => p.transaction_id === action.transaction_id)) {
        throw new Error(
          "That transaction is a SIP payment — unmark the SIP for that month instead of editing it directly."
        )
      }

      const linkedParty = (
        await fetchTable<PartyTransaction>("party_transactions", uid, {
          filters: [{ column: "linked_transaction_id", op: "eq", value: action.transaction_id }],
        })
      )[0]

      if (action.kind === "update_transaction") {
        if (linkedParty && action.type !== undefined && action.type !== current.type) {
          throw new Error(
            "This transaction backs a party entry — flipping income/expense would break that link. Edit the party entry instead."
          )
        }
        const patch: Record<string, unknown> = {}
        const prev: Record<string, unknown> = {}
        for (const key of ["amount", "category", "type", "description", "date"] as const) {
          if (action[key] !== undefined) {
            patch[key] = action[key]
            prev[key] = current[key] ?? null
          }
        }
        const { error } = await updateRow("transactions", current.id, patch)
        if (error) throw new Error(error)
        const targets = [{ table: "transactions", id: current.id, prev }]

        // Keep the backing party entry in sync when money facts change —
        // otherwise the party ledger and cash flow drift apart.
        if (linkedParty && (action.amount !== undefined || action.date !== undefined)) {
          const pPatch: Record<string, unknown> = {}
          const pPrev: Record<string, unknown> = {}
          if (action.amount !== undefined) {
            pPatch.amount = action.amount
            pPrev.amount = Number(linkedParty.amount)
          }
          if (action.date !== undefined) {
            pPatch.date = action.date
            pPrev.date = linkedParty.date
          }
          const { error: pError } = await updateRow("party_transactions", linkedParty.id, pPatch)
          if (!pError) targets.push({ table: "party_transactions", id: linkedParty.id, prev: pPrev })
        }
        return {
          receipt: `Updated ${action.summary}${linkedParty ? " (party entry updated too)" : ""}`,
          undo: { type: "revert", targets },
        }
      }

      // delete_transaction — cascade the backing party entries, exactly like
      // the Transactions page delete does, and capture rows for undo.
      const linkedPartyRows = await fetchTable<PartyTransaction>("party_transactions", uid, {
        filters: [{ column: "linked_transaction_id", op: "eq", value: action.transaction_id }],
      })
      for (const p of linkedPartyRows) await deleteRow("party_transactions", p.id)
      const { error: delError } = await deleteRow("transactions", current.id)
      if (delError) throw new Error(delError)
      return {
        receipt: `Deleted ${action.summary}${linkedPartyRows.length ? " (linked party entry removed too)" : ""}`,
        undo: {
          type: "restore",
          rows: [
            { table: "transactions", row: current as unknown as Record<string, unknown> },
            ...linkedPartyRows.map((p) => ({
              table: "party_transactions",
              row: p as unknown as Record<string, unknown>,
            })),
          ],
        },
      }
    }

    if (action.kind === "mark_sip_paid") {
      // The SIP API owns this logic: dedupe per month, reconcile an already-
      // logged investment expense, create + link the expense otherwise.
      const res = await fetch("/api/sip-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sipId: action.sip_id, monthKey: action.month }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not mark the SIP paid")
      return {
        receipt: `Marked ${action.summary}${data.reconciled ? " (matched an existing expense)" : ""}`,
        undo: { type: "sip_unmark", paymentId: data.payment.id as string },
      }
    }

    if (action.kind === "query") {
      // Read-only queries are auto-run in send(), never confirmed/executed here.
      throw new Error("Queries don't need confirmation.")
    }

    // set_budget: update the month's row when it exists, else insert.
    const budgets = await fetchTable<Budget>("budgets", uid, {
      filters: [{ column: "month", op: "eq", value: action.month }],
    })
    const existing = budgets.find(
      (b) => b.profile_id === pid && b.category === action.category
    )
    if (existing) {
      const { error } = await updateRow("budgets", existing.id, { amount: action.amount })
      if (error) throw new Error(error)
      return {
        receipt: `Set ${action.summary}`,
        undo: {
          type: "revert",
          targets: [{ table: "budgets", id: existing.id, prev: { amount: Number(existing.amount) } }],
        },
      }
    }
    const { data, error } = await insertRow<{ id: string }>("budgets", {
      user_id: uid,
      profile_id: pid,
      month: action.month,
      category: action.category,
      amount: action.amount,
    })
    if (error || !data) throw new Error(error || "Insert failed")
    return {
      receipt: `Set ${action.summary}`,
      undo: { type: "delete", rows: [{ table: "budgets", id: data.id }] },
    }
  }

  async function confirm() {
    if (!pending || busy) return
    setBusy(true)
    try {
      const { receipt, undo } = await execute(pending)
      setPending(null)
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: receipt, receipt, undo },
      ])
      queryClient.invalidateQueries()
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Couldn't do that: ${err instanceof Error ? err.message : "unknown error"}`,
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  async function undoMessage(msg: ChatMessage) {
    if (!msg.undo || msg.undone || busy) return
    setBusy(true)
    try {
      if (msg.undo.type === "delete") {
        for (const row of msg.undo.rows) await deleteRow(row.table, row.id)
      } else if (msg.undo.type === "revert") {
        for (const t of msg.undo.targets) await updateRow(t.table, t.id, t.prev)
      } else if (msg.undo.type === "restore") {
        for (const r of msg.undo.rows) await insertRow(r.table, r.row)
      } else {
        await fetch("/api/sip-payments", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId: msg.undo.paymentId }),
        })
      }
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, undone: true } : m)))
      queryClient.invalidateQueries()
    } finally {
      setBusy(false)
    }
  }

  if (!user || !activeProfile) return null

  return (
    <>
      {/* Trigger: a rounded pill docked at the bottom, like a chat bubble
          waiting to be tapped. Sits above the mobile bottom nav. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open FinBoom assistant"
          className="fixed z-50 bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 lg:left-auto lg:translate-x-0 lg:right-6 flex items-center gap-2.5 pl-4 pr-5 py-3 rounded-full bg-white dark:bg-[#2c2c2e] border border-black/[0.12] dark:border-white/[0.16] shadow-[0_8px_30px_rgba(0,0,0,0.18)] hover:shadow-[0_10px_36px_rgba(0,0,0,0.24)] active:scale-95 transition-all whitespace-nowrap"
        >
          <Sparkles className="w-5 h-5 text-accent" />
          <span className="text-sm font-medium text-[#1d1d1f] dark:text-white">Ask FinBoom…</span>
        </button>
      )}

      {open && (
        <div className="fixed z-50 inset-x-0 bottom-0 lg:inset-auto lg:bottom-6 lg:right-6 lg:w-[400px] flex flex-col h-[75vh] lg:h-[600px] bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-xl rounded-t-3xl lg:rounded-2xl shadow-[0_16px_60px_rgba(0,0,0,0.28)] border border-black/[0.12] dark:border-white/[0.16]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.04] dark:border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <p className="text-sm font-semibold text-[#1d1d1f] dark:text-white">Assistant</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSessionList(sessionList ? null : readSessions())}
                aria-label="Chat history"
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all"
              >
                <History className="w-4 h-4 text-[#86868b]" />
              </button>
              <button
                onClick={startNewChat}
                aria-label="New chat"
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all"
              >
                <Plus className="w-4 h-4 text-[#86868b]" />
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all"
              >
                <X className="w-4 h-4 text-[#86868b]" />
              </button>
            </div>
          </div>

          {sessionList && (
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
              {sessionList.length === 0 && (
                <p className="text-sm text-[#86868b] text-center pt-6">No past chats yet.</p>
              )}
              {sessionList.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2.5 cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.06] ${
                    s.id === activeSessionId ? "bg-black/[0.05] dark:bg-white/[0.08]" : ""
                  }`}
                  onClick={() => openSession(s)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#1d1d1f] dark:text-white truncate">{s.title}</p>
                    <p className="text-[11px] text-[#86868b]">
                      {new Date(s.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteSession(s.id)
                    }}
                    aria-label={`Delete chat ${s.title}`}
                    className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[#86868b]" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {!sessionList && (
          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
            {messages.length === 0 && (
              <div className="text-sm text-[#86868b] space-y-2 pt-4">
                <p>Tell me what happened — I&apos;ll do the bookkeeping. Try:</p>
                <p className="text-[#1d1d1f] dark:text-white">&ldquo;Spent 250 on groceries yesterday&rdquo;</p>
                <p className="text-[#1d1d1f] dark:text-white">&ldquo;Ramesh returned 2000&rdquo;</p>
                <p className="text-[#1d1d1f] dark:text-white">&ldquo;How much did I spend on food this month?&rdquo;</p>
              </div>
            )}
            {messages.filter((m) => !m.hidden).map((m) => (
              <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                    m.role === "user"
                      ? "bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f]"
                      : m.receipt
                        ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                        : "bg-black/[0.05] dark:bg-white/[0.08] text-[#1d1d1f] dark:text-white"
                  }`}
                >
                  {m.receipt && <Check className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />}
                  {m.content}
                  {m.undo && !m.undone && (
                    <button
                      onClick={() => undoMessage(m)}
                      className="ml-2 inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-2 hover:opacity-80"
                    >
                      <Undo2 className="w-3 h-3" /> Undo
                    </button>
                  )}
                  {m.undone && <span className="ml-2 text-xs opacity-70">(undone)</span>}
                  {/* Quick-reply chips: only on the newest message, gone once answered */}
                  {m.options &&
                    m === messages.filter((x) => !x.hidden).at(-1) &&
                    !pending &&
                    !busy && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {m.options.map((o) => (
                          <button
                            key={o}
                            onClick={() => void send(o)}
                            className="px-3 py-1.5 rounded-full text-xs font-medium bg-white dark:bg-white/[0.08] border border-black/10 dark:border-white/15 text-[#1d1d1f] dark:text-white hover:border-accent hover:text-accent transition-colors"
                          >
                            {o}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-1.5 text-[#86868b] pl-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-xs">Thinking…</span>
              </div>
            )}
          </div>
          )}

          {pending && !sessionList && (
            <div className="mx-4 mb-2 p-3 rounded-xl border border-accent/25 bg-accent/[0.06]">
              <p className="text-xs font-medium uppercase tracking-wide text-accent">Confirm</p>
              <p className="mt-1 text-sm text-[#1d1d1f] dark:text-white break-words">{pending.summary}</p>
              <div className="mt-2.5 flex gap-2">
                <button
                  onClick={confirm}
                  disabled={busy}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setPending(null)}
                  disabled={busy}
                  className="flex-1 py-2 rounded-lg text-sm font-medium bg-black/[0.05] dark:bg-white/[0.08] text-[#1d1d1f] dark:text-white hover:bg-black/[0.08] dark:hover:bg-white/[0.12] disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!sessionList && (
          <div className="p-3 border-t border-black/[0.04] dark:border-white/[0.06]">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    void send()
                  }
                }}
                placeholder='e.g. "I spent 10 rs for tea"'
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/60 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] outline-none focus:ring-2 focus:ring-accent/40"
              />
              <button
                onClick={() => void send()}
                disabled={busy || !input.trim()}
                aria-label="Send"
                className="p-2.5 rounded-xl bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
          )}
        </div>
      )}
    </>
  )
}
