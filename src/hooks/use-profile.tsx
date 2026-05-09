"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { useUser } from "@/hooks/use-auth"
import { useOfflineQuery } from "@/hooks/use-offline-query"
import { insertRow, fetchTable } from "@/lib/offline"
import { useQueryClient } from "@tanstack/react-query"
import type { Profile } from "@/lib/types"

interface ProfileContextValue {
  profiles: Profile[]
  activeProfile: Profile | null
  switchProfile: (id: string) => void
  reloadProfiles: () => Promise<void>
  isLoaded: boolean
}

const ProfileContext = createContext<ProfileContextValue>({
  profiles: [],
  activeProfile: null,
  switchProfile: () => {},
  reloadProfiles: async () => {},
  isLoaded: false,
})

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser()
  const queryClient = useQueryClient()
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [didAutoCreate, setDidAutoCreate] = useState(false)

  const { data: fetchedProfiles = [], isSuccess } = useOfflineQuery<Profile>(
    "profiles", user?.id, {
      order: { column: "created_at", ascending: true },
    }
  )

  // Auto-create default profile if none exist
  useEffect(() => {
    if (!user || !isSuccess || didAutoCreate) return
    if (fetchedProfiles.length === 0) {
      setDidAutoCreate(true)
      insertRow<Profile>("profiles", {
        user_id: user.id,
        name: "Personal",
        type: "personal",
        is_default: true,
      }).then(({ data: newProfile }) => {
        if (newProfile) {
          setActiveProfileId(newProfile.id)
          queryClient.invalidateQueries({ queryKey: ["profiles"] })
        }
      })
    }
  }, [user, isSuccess, fetchedProfiles.length, didAutoCreate, queryClient])

  // Set active profile from localStorage or default when profiles load
  useEffect(() => {
    if (!user || fetchedProfiles.length === 0) return
    if (activeProfileId && fetchedProfiles.find((p) => p.id === activeProfileId)) return

    const stored = localStorage.getItem(`finboom_active_profile_${user.id}`)
    const valid = fetchedProfiles.find((p) => p.id === stored)
    if (valid) {
      setActiveProfileId(valid.id)
    } else {
      const def = fetchedProfiles.find((p) => p.is_default) || fetchedProfiles[0]
      setActiveProfileId(def.id)
    }
  }, [user, fetchedProfiles, activeProfileId])

  function switchProfile(id: string) {
    if (!user) return
    setActiveProfileId(id)
    localStorage.setItem(`finboom_active_profile_${user.id}`, id)
  }

  const reloadProfiles = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["profiles"] })
  }, [queryClient])

  const activeProfile = fetchedProfiles.find((p) => p.id === activeProfileId) || null
  const isLoaded = isSuccess && (fetchedProfiles.length > 0 || didAutoCreate)

  // Prefetch common dashboard tables when active profile is set
  useEffect(() => {
    if (!user || !activeProfile) return
    const pf = [{ column: "profile_id" as const, op: "eq" as const, value: activeProfile.id }]
    const tables = ["assets", "liabilities", "goals"] as const
    for (const table of tables) {
      queryClient.prefetchQuery({
        queryKey: [table, user.id, pf, null, null],
        queryFn: () => fetchTable(table, user.id, { filters: pf }),
      })
    }
    // Snapshots with order + limit to match dashboard query key
    const snapshotOrder = { column: "snapshot_date", ascending: true }
    queryClient.prefetchQuery({
      queryKey: ["snapshots", user.id, pf, snapshotOrder, 12],
      queryFn: () => fetchTable("snapshots", user.id, { filters: pf, order: snapshotOrder, limit: 12 }),
    })
    // party_transactions has no profile filter
    queryClient.prefetchQuery({
      queryKey: ["party_transactions", user.id, null, null, null],
      queryFn: () => fetchTable("party_transactions", user.id),
    })
  }, [user, activeProfile, queryClient])

  return (
    <ProfileContext value={{
      profiles: fetchedProfiles,
      activeProfile,
      switchProfile,
      reloadProfiles,
      isLoaded,
    }}>
      {children}
    </ProfileContext>
  )
}

export function useProfile() {
  return useContext(ProfileContext)
}
