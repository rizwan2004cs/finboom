import type { PartyTransaction } from "@/lib/types"

/** Minimal row shape the allocator needs — lets server-side crons pass raw
 *  Supabase rows (where `type` is a plain string and `due_date` may be null)
 *  without casting to the full PartyTransaction. */
export type PartyEntry = Pick<PartyTransaction, "id" | "party_id" | "amount" | "date"> & {
  type: string
  due_date?: string | null
  settles_transaction_id?: string | null
}

export function isObligation(tx: Pick<PartyEntry, "type">): boolean {
  return tx.type === "lent" || tx.type === "borrowed"
}

/** Signed effect of an entry on what the party owes you: positive when they
 *  owe you more, negative when you owe them more. */
function netSign(type: string): number {
  if (type === "lent" || type === "paid_back") return 1
  if (type === "received_back" || type === "borrowed") return -1
  return 0
}

/** Net balance per party: > 0 they owe you (receivable), < 0 you owe them
 *  (payable). Every party that has at least one entry appears in the map. */
export function partyNetBalances(txs: PartyEntry[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const tx of txs) {
    map.set(tx.party_id, (map.get(tx.party_id) ?? 0) + netSign(tx.type) * Number(tx.amount))
  }
  return map
}

/** Remaining outstanding per individual obligation (lent/borrowed entry).
 *  Repayments carrying settles_transaction_id (entry-level Settle, or picked
 *  in the modal's "settles which entry" select) reduce THAT entry first; any
 *  unlinked repayment (or the overflow of a linked one) is allocated LIFO —
 *  newest obligation first, matching how people actually settle ("that last
 *  ₹500"). Allocation runs per party and per direction (lent↔received_back,
 *  borrowed↔paid_back), so a fully-repaid entry drops off the overdue list
 *  even when the party still has other open obligations. */
export function outstandingByEntry(txs: PartyEntry[]): Map<string, number> {
  const remaining = new Map<string, number>()
  const byParty = new Map<string, PartyEntry[]>()
  for (const tx of txs) {
    const list = byParty.get(tx.party_id)
    if (list) list.push(tx)
    else byParty.set(tx.party_id, [tx])
  }

  const allocate = (entries: PartyEntry[], obligation: string, repayment: string) => {
    // ISO dates compare lexicographically; avoids UTC-midnight Date parsing.
    const obligations = entries
      .filter(t => t.type === obligation)
      .sort((a, b) => a.date.localeCompare(b.date))
    const open = new Map(obligations.map(o => [o.id, Number(o.amount)]))

    // Phase 1: targeted repayments hit their linked entry; overflow (and
    // repayments without a link) feed the LIFO pool.
    let pool = 0
    for (const t of entries.filter(t => t.type === repayment)) {
      const target = t.settles_transaction_id
      const cur = target ? open.get(target) : undefined
      if (target && cur !== undefined) {
        const used = Math.min(cur, Number(t.amount))
        open.set(target, cur - used)
        pool += Number(t.amount) - used
      } else {
        pool += Number(t.amount)
      }
    }

    // Phase 2: LIFO the pool over whatever is still open (newest first).
    for (const ob of [...obligations].reverse()) {
      const cur = open.get(ob.id) ?? 0
      const used = Math.min(cur, pool)
      pool -= used
      remaining.set(ob.id, cur - used)
    }
  }

  for (const entries of byParty.values()) {
    allocate(entries, "lent", "received_back")
    allocate(entries, "borrowed", "paid_back")
  }
  return remaining
}

/** Outstanding on one obligation; the full amount when it was not allocated
 *  (e.g. an entry from outside the list the map was built from). */
export function entryOutstanding(tx: PartyEntry, outstanding: Map<string, number>): number {
  if (!isObligation(tx)) return 0
  return outstanding.get(tx.id) ?? Number(tx.amount)
}

/** An obligation is open while it still has an outstanding remainder.
 *  Repayment rows are never "open". */
export function isEntryOpen(tx: PartyEntry, outstanding: Map<string, number>): boolean {
  return entryOutstanding(tx, outstanding) > 0
}

/** Open obligations with a due date inside [fromISO, toISO] (inclusive). */
export function entriesDueInWindow<T extends PartyEntry>(
  txs: T[],
  fromISO: string,
  toISO: string,
  outstanding: Map<string, number> = outstandingByEntry(txs),
): T[] {
  return txs.filter(
    tx =>
      !!tx.due_date &&
      tx.due_date >= fromISO &&
      tx.due_date <= toISO &&
      isEntryOpen(tx, outstanding),
  )
}

/** Σ remaining outstanding of `lent` entries due inside the window — what the
 *  dashboard "Receivable in 30 Days" and the parties "Due in 30 Days" tiles
 *  both show. Uses each entry's allocated remainder, never the gross amount or
 *  the party net, so a targeted repayment on one entry shrinks only that entry. */
export function receivableDueInWindow(txs: PartyEntry[], fromISO: string, toISO: string): number {
  const outstanding = outstandingByEntry(txs)
  const net = partyNetBalances(txs)
  const dueByParty = new Map<string, number>()
  for (const tx of entriesDueInWindow(txs, fromISO, toISO, outstanding)) {
    if (tx.type !== "lent") continue
    dueByParty.set(tx.party_id, (dueByParty.get(tx.party_id) ?? 0) + entryOutstanding(tx, outstanding))
  }
  // A party you also owe money to can't be due more than they net owe you,
  // so the 30-day figure never exceeds "Total Receivable" beside it.
  let sum = 0
  for (const [partyId, due] of dueByParty) sum += Math.min(due, Math.max(0, net.get(partyId) ?? 0))
  return sum
}

/** Still-open lent/borrowed entries whose due date is before `todayISO`. */
export function overdueEntries<T extends PartyEntry>(
  txs: T[],
  todayISO: string,
  outstanding: Map<string, number> = outstandingByEntry(txs),
): T[] {
  return txs.filter(tx => !!tx.due_date && tx.due_date < todayISO && isEntryOpen(tx, outstanding))
}
