"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useUser } from "@/hooks/use-auth"
import { useProfile } from "@/hooks/use-profile"
import { useOfflineQuery } from "@/hooks/use-offline-query"
import { insertRow } from "@/lib/offline"
import { todayLocalISO } from "@/lib/utils"
import type { Account } from "@/lib/types"

// One seed attempt per profile per session, shared across every component
// using this hook — two simultaneous mounts (e.g. dashboard + modal) must not
// both insert a Cash account.
const seededProfiles = new Set<string>()

/** Accounts of the active profile, plus one-time seeding of the built-in
 *  "Cash" account (Vyapar's Cash In Hand) when a profile has none yet. */
export function useAccounts() {
  const { user } = useUser()
  const { activeProfile } = useProfile()
  const queryClient = useQueryClient()

  const pf = activeProfile
    ? [{ column: "profile_id", op: "eq" as const, value: activeProfile.id }]
    : undefined

  const query = useOfflineQuery<Account>("accounts", user?.id, {
    filters: pf,
    order: { column: "created_at", ascending: true },
    enabled: !!activeProfile,
  })

  const { data: accounts = [], isLoading, isFetched } = query

  useEffect(() => {
    if (!user || !activeProfile || !isFetched || isLoading) return
    const key = `finboom_accounts_seeded_${activeProfile.id}`
    if (accounts.length > 0) {
      // Profile demonstrably has (or had) accounts — never seed it later, so
      // deliberately deleting the last account doesn't resurrect "Cash".
      seededProfiles.add(activeProfile.id)
      try { localStorage.setItem(key, "1") } catch { /* private mode */ }
      return
    }
    let marked = seededProfiles.has(activeProfile.id)
    try { marked = marked || !!localStorage.getItem(key) } catch { /* private mode */ }
    if (marked) return
    // Only seed from an authoritative online empty result — an offline cache
    // miss says nothing about the server, and seeding there would duplicate
    // the Cash account already created on another device.
    if (typeof navigator !== "undefined" && !navigator.onLine) return
    seededProfiles.add(activeProfile.id)
    try { localStorage.setItem(key, "1") } catch { /* private mode */ }
    insertRow<Account>("accounts", {
      user_id: user.id,
      profile_id: activeProfile.id,
      name: "Cash",
      type: "cash",
      opening_balance: 0,
      opening_date: todayLocalISO(),
      updated_at: new Date().toISOString(),
    }).then((res) => {
      if (!res.error) queryClient.invalidateQueries({ queryKey: ["accounts"] })
    })
  }, [user, activeProfile, accounts.length, isFetched, isLoading, queryClient])

  return { ...query, accounts }
}
