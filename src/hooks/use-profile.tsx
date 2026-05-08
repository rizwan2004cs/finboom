"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { useUser } from "@/hooks/use-auth"
import { fetchTable, insertRow } from "@/lib/offline"
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
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  const loadProfiles = useCallback(async () => {
    if (!user) return
    const data = await fetchTable<Profile>("profiles", user.id, {
      order: { column: "created_at", ascending: true },
    })

    if (data.length === 0) {
      // Auto-create default Personal profile
      const { data: newProfile } = await insertRow<Profile>("profiles", {
        user_id: user.id,
        name: "Personal",
        type: "personal",
        is_default: true,
      })
      if (newProfile) {
        setProfiles([newProfile])
        setActiveProfileId(newProfile.id)
      }
    } else {
      setProfiles(data)
      // Restore last active profile from localStorage, or use default
      const stored = localStorage.getItem(`finboom_active_profile_${user.id}`)
      const valid = data.find((p) => p.id === stored)
      if (valid) {
        setActiveProfileId(valid.id)
      } else {
        const def = data.find((p) => p.is_default) || data[0]
        setActiveProfileId(def.id)
      }
    }
    setIsLoaded(true)
  }, [user])

  useEffect(() => {
    loadProfiles()
  }, [loadProfiles])

  function switchProfile(id: string) {
    if (!user) return
    setActiveProfileId(id)
    localStorage.setItem(`finboom_active_profile_${user.id}`, id)
  }

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || null

  return (
    <ProfileContext value={{
      profiles,
      activeProfile,
      switchProfile,
      reloadProfiles: loadProfiles,
      isLoaded,
    }}>
      {children}
    </ProfileContext>
  )
}

export function useProfile() {
  return useContext(ProfileContext)
}
