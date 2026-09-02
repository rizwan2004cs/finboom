import type { PartyTransaction, SipPayment, Transaction } from "@/lib/types"
import { deleteRow, fetchTable } from "@/lib/offline/data"
import { getAll, remove as idbRemove } from "@/lib/offline/db"

/**
 * Delete a transaction together with everything that hangs off it, through the
 * offline layer so the cascade also lands in IndexedDB (delta sync cannot see
 * server-side deletes):
 *
 * - every leg sharing `tx.transfer_group_id` (a transfer / card-bill payment is
 *   two rows — removing one side would silently corrupt both balances);
 * - `party_transactions` whose `linked_transaction_id` points at a leg;
 * - cached `sip_payments` whose `transaction_id` points at a leg. Only the IDB
 *   copy is touched: the server FK is `on delete cascade`, and the row is owned
 *   by /api/sip-payments, so this keeps the client consistent while offline
 *   without a network round-trip (and without unmarkSipPaid's 409 semantics).
 *
 * Every surface that deletes a transaction (Transactions page, assistant,
 * parties page, profile delete) must go through here so they behave the same.
 *
 * Callers must invalidate the React Query keys `["transactions"]`,
 * `["party_transactions"]` and `["sip_payments"]` afterwards.
 *
 * Returns the legs actually removed (all of them on success; the ones removed
 * before a failure otherwise) so callers can offer Undo by re-inserting them,
 * plus the party rows removed for the same purpose.
 */
export async function deleteTransactionWithLinks(
  userId: string,
  tx: Transaction,
  opts?: { sipPayments?: SipPayment[]; partyTransactions?: PartyTransaction[] },
): Promise<{
  deleted: Transaction[]
  deletedPartyTransactions: PartyTransaction[]
  error: string | null
}> {
  const groupId = tx.transfer_group_id
  const legs = groupId
    ? (
        await fetchTable<Transaction>("transactions", userId, {
          filters: [{ column: "transfer_group_id", op: "eq", value: groupId }],
        })
      ).filter((l) => l.transfer_group_id === groupId) // belt and braces: never widen past the group
    : [tx]
  // A stale cache can miss the row we were handed; never end up deleting nothing.
  if (!legs.some((l) => l.id === tx.id)) legs.push(tx)
  const legIds = new Set(legs.map((l) => l.id))

  let partyRows: PartyTransaction[] = []
  try {
    const all = opts?.partyTransactions
      ?? await fetchTable<PartyTransaction>("party_transactions", userId)
    partyRows = all.filter((p) => !!p.linked_transaction_id && legIds.has(p.linked_transaction_id))
  } catch (e) {
    console.warn("Could not look up linked party transactions:", e)
  }

  let cachedPayments: SipPayment[] = []
  try {
    cachedPayments = opts?.sipPayments ?? await getAll<SipPayment>("sip_payments")
  } catch (e) {
    console.warn("Could not look up linked SIP payments:", e)
  }

  const deleted: Transaction[] = []
  const deletedPartyTransactions: PartyTransaction[] = []

  for (const leg of legs) {
    // The leg goes first: if it can't be removed, its party rows and SIP
    // payment must stay too, or the ledger is orphaned while the UI reports
    // that nothing was deleted.
    let { error } = await deleteRow("transactions", leg.id)
    if (error) {
      // One retry so a transient rejection can't strand a one-sided transfer;
      // if it still fails, stop — the central write-error toaster surfaces the
      // message rather than pretending success.
      ;({ error } = await deleteRow("transactions", leg.id))
      if (error) return { deleted, deletedPartyTransactions, error }
    }
    deleted.push(leg)

    for (const p of partyRows.filter((r) => r.linked_transaction_id === leg.id)) {
      const { error: partyError } = await deleteRow("party_transactions", p.id)
      if (!partyError) deletedPartyTransactions.push(p)
    }
    for (const p of cachedPayments.filter((r) => r.transaction_id === leg.id)) {
      await idbRemove("sip_payments", p.id).catch(() => {})
    }
  }

  return { deleted, deletedPartyTransactions, error: null }
}
