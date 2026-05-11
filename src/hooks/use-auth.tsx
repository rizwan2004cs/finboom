"use client"

import { useEffect, useState } from "react"
import { useUser as useClerkUser, useAuth as useClerkAuth } from "@clerk/nextjs"

const CACHED_USER_KEY = "finboom-cached-user"

type AuthUser = {
  id: string
  email: string | undefined
  firstName: string | undefined
  fullName: string | undefined
  imageUrl: string | undefined
}

function getCachedUser(): AuthUser | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(CACHED_USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function useUser() {
  const { user, isLoaded, isSignedIn } = useClerkUser()
  const [offlineUser, setOfflineUser] = useState<AuthUser | null>(null)

  const mapped: AuthUser | null = user
    ? {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        firstName: user.firstName ?? undefined,
        fullName: user.fullName ?? undefined,
        imageUrl: user.imageUrl ?? undefined,
      }
    : null

  // Cache user to localStorage when online and authenticated
  useEffect(() => {
    if (mapped) {
      localStorage.setItem(CACHED_USER_KEY, JSON.stringify(mapped))
    }
  }, [mapped?.id])

  // When Clerk can't load (offline), fall back to cached user
  useEffect(() => {
    if (!isLoaded && !navigator.onLine) {
      const cached = getCachedUser()
      if (cached) setOfflineUser(cached)
    }
  }, [isLoaded])

  // If Clerk loaded, use Clerk data. If offline and Clerk can't load, use cached.
  const effectiveUser = mapped ?? offlineUser
  const effectiveSignedIn = isSignedIn ?? (offlineUser !== null)
  const effectiveLoaded = isLoaded || offlineUser !== null

  return { user: effectiveUser, isLoaded: effectiveLoaded, isSignedIn: effectiveSignedIn }
}

export function useAuth() {
  const { isSignedIn, isLoaded, signOut } = useClerkAuth()
  const isOfflineWithCache = !isLoaded && !navigator.onLine && getCachedUser() !== null
  return {
    isSignedIn: (isSignedIn ?? false) || isOfflineWithCache,
    isLoaded: isLoaded || isOfflineWithCache,
    signOut: async () => {
      localStorage.removeItem(CACHED_USER_KEY)
      await signOut()
      window.location.href = "/"
    },
  }
}

// Keep AuthProvider as a no-op wrapper for backward compatibility
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
