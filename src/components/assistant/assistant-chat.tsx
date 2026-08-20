"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useUser } from "@/hooks/use-auth"
import { useProfile } from "@/hooks/use-profile"
import { fetchTable, insertRow, updateRow, deleteRow } from "@/lib/offline"
import { todayLocalISO } from "@/lib/utils"
import type { Account, Asset, Budget, Party, Transaction } from "@/lib/types"
import type {
  AssistantAction,
  AssistantContext,
  AssistantMessage,
  AssistantResponse,
} from "@/lib/assistant/actions"
import { Sparkles, X, Send, Loader2, Check, Undo2 } from "lucide-react"

// In-app AI assistant: type "I spent 10 rs for tea" → the model extracts the
// fields (asking only for what's missing), proposes one action, and after an
// explicit Confirm the CLIENT executes it through the same offline-first
// mutations the manual modals use. Every receipt has Undo.

type UndoPlan =
  | { type: "delete"; rows: Array<{ table: string; id: string }> }
  | { type: "revert"; table: string; id: string; prev: Record<string, unknown> }

type ChatMessage = AssistantMessage & {
  id: string
  receipt?: string
  undo?: UndoPlan
  undone?: boolean
}

type PendingAction = AssistantAction & { summary: string }

const HISTORY_LIMIT = 40

export function AssistantChat() {
  const { user } = useUser()
  const { activeProfile } = useProfile()
  const queryClient = useQueryClient()

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const historyKey = user && activeProfile ? `finboom_assistant_${user.id}_${activeProfile.id}` : null

  // Restore per-profile history (receipts survive; pending actions don't).
  useEffect(() => {
    if (!historyKey) return
    try {
      const saved = localStorage.getItem(historyKey)
      setMessages(saved ? (JSON.parse(saved) as ChatMessage[]) : [])
    } catch {
      setMessages([])
    }
    setPending(null)
  }, [historyKey])

  useEffect(() => {
    if (!historyKey) return
    try {
      localStorage.setItem(historyKey, JSON.stringify(messages.slice(-HISTORY_LIMIT)))
    } catch {
      /* storage unavailable */
    }
  }, [messages, historyKey])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, pending, busy, open])

  const buildContext = useCallback(async (): Promise<AssistantContext> => {
    const uid = user!.id
    const pid = activeProfile!.id
    const today = todayLocalISO()
    const month = today.slice(0, 7)
    const [accounts, parties, assets, budgets, monthTx] = await Promise.all([
      fetchTable<Account>("accounts", uid),
      fetchTable<Party>("parties", uid),
      fetchTable<Asset>("assets", uid),
      fetchTable<Budget>("budgets", uid, {
        filters: [{ column: "month", op: "eq", value: month }],
      }),
      fetchTable<Transaction>("transactions", uid, {
        filters: [{ column: "date", op: "gte", value: `${month}-01` }],
      }),
    ])
    const profileTx = monthTx.filter((t) => t.profile_id === pid)
    const expenseByCategory: Record<string, number> = {}
    let incomeTotal = 0
    let expenseTotal = 0
    for (const t of profileTx) {
      const amt = Number(t.amount)
      if (t.type === "income") incomeTotal += amt
      else {
        expenseTotal += amt
        expenseByCategory[t.category] = (expenseByCategory[t.category] ?? 0) + amt
      }
    }
    return {
      today,
      month,
      accounts: accounts.map((a) => ({ id: a.id, name: a.name, type: a.type })),
      parties: parties.map((p) => ({ id: p.id, name: p.name })),
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
      stats: { incomeTotal, expenseTotal, expenseByCategory },
    }
  }, [user, activeProfile])

  async function send() {
    const text = input.trim()
    if (!text || busy || !user || !activeProfile) return
    setInput("")
    setPending(null)
    const next: ChatMessage[] = [...messages, { id: crypto.randomUUID(), role: "user", content: text }]
    setMessages(next)
    setBusy(true)
    try {
      const context = await buildContext()
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
          context,
        }),
      })
      const data = (await res.json()) as AssistantResponse & { error?: string }
      if (!res.ok) throw new Error(data.error || "Request failed")
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: data.reply },
      ])
      if (data.action) setPending(data.action)
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
          table: "assets",
          id: action.asset_id,
          prev: {
            current_value: Number(current.current_value),
            invested_value: Number(current.invested_value),
          },
        },
      }
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
          table: "budgets",
          id: existing.id,
          prev: { amount: Number(existing.amount) },
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
      } else {
        await updateRow(msg.undo.table, msg.undo.id, msg.undo.prev)
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
          className="fixed z-50 bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 lg:left-auto lg:translate-x-0 lg:right-6 flex items-center gap-2.5 pl-4 pr-5 py-3 rounded-full glass-elevated border border-black/[0.08] dark:border-white/[0.12] shadow-xl hover:shadow-2xl active:scale-95 transition-all whitespace-nowrap"
        >
          <Sparkles className="w-5 h-5 text-accent" />
          <span className="text-sm font-medium text-[#1d1d1f] dark:text-white">Ask FinBoom…</span>
        </button>
      )}

      {open && (
        <div className="fixed z-50 inset-x-0 bottom-0 lg:inset-auto lg:bottom-6 lg:right-6 lg:w-[400px] flex flex-col h-[75vh] lg:h-[600px] glass-elevated rounded-t-3xl lg:rounded-2xl shadow-2xl border border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.04] dark:border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <p className="text-sm font-semibold text-[#1d1d1f] dark:text-white">Assistant</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all"
            >
              <X className="w-4 h-4 text-[#86868b]" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
            {messages.length === 0 && (
              <div className="text-sm text-[#86868b] space-y-2 pt-4">
                <p>Tell me what happened — I&apos;ll do the bookkeeping. Try:</p>
                <p className="text-[#1d1d1f] dark:text-white">&ldquo;Spent 250 on groceries yesterday&rdquo;</p>
                <p className="text-[#1d1d1f] dark:text-white">&ldquo;Ramesh returned 2000&rdquo;</p>
                <p className="text-[#1d1d1f] dark:text-white">&ldquo;How much did I spend on food this month?&rdquo;</p>
              </div>
            )}
            {messages.map((m) => (
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

          {pending && (
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
        </div>
      )}
    </>
  )
}
