"use client"

import { useEffect, useState } from "react"
import { useUser as useClerkUser, useAuth as useClerkAuth } from "@clerk/nextjs"

const CACHED_USER_KEY = "finboom-cached-user"
// If Clerk hasn't loaded after this long (flaky network, captive portal,
// PWA cold start), fall back to the cached identity instead of showing
// the user a logged-out state.
const CLERK_LOAD_GRACE_MS = 4000

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

function clearCachedUser() {
  try {
    localStorage.removeItem(CACHED_USER_KEY)
  } catch {
    // storage unavailable - nothing to clear
  }
}

// Returns the cached user while Clerk is unable to load (offline or slow
// network). Clears itself as soon as Clerk loads so a real signed-out
// state is never masked by a stale cache.
function useCachedFallback(isClerkLoaded: boolean): AuthUser | null {
  const [fallback, setFallback] = useState<AuthUser | null>(null)

  useEffect(() => {
    if (isClerkLoaded) {
      setFallback(null)
      return
    }

    const applyCache = () => setFallback(getCachedUser())

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      applyCache()
    }

    const timer = setTimeout(applyCache, CLERK_LOAD_GRACE_MS)
    window.addEventListener("offline", applyCache)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("offline", applyCache)
    }
  }, [isClerkLoaded])

  return fallback
}

export function useUser() {
  const { user, isLoaded, isSignedIn } = useClerkUser()
  const fallbackUser = useCachedFallback(isLoaded)

  const mapped: AuthUser | null = user
    ? {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        firstName: user.firstName ?? undefined,
        fullName: user.fullName ?? undefined,
        imageUrl: user.imageUrl ?? undefined,
      }
    : null

  // Cache user to localStorage when online and authenticated, so the PWA
  // can restore the session UI when Clerk is unreachable.
  useEffect(() => {
    if (mapped) {
      try {
        localStorage.setItem(CACHED_USER_KEY, JSON.stringify(mapped))
      } catch {
        // storage unavailable - skip caching
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapped?.id])

  const effectiveUser = mapped ?? fallbackUser
  const effectiveSignedIn = isSignedIn ?? fallbackUser !== null
  const effectiveLoaded = isLoaded || fallbackUser !== null

  return { user: effectiveUser, isLoaded: effectiveLoaded, isSignedIn: effectiveSignedIn }
}

export function useAuth() {
  const { isSignedIn, isLoaded, signOut } = useClerkAuth()
  const fallbackUser = useCachedFallback(isLoaded)
  const offlineSignedIn = !isLoaded && fallbackUser !== null

  return {
    isSignedIn: (isSignedIn ?? false) || offlineSignedIn,
    isLoaded: isLoaded || offlineSignedIn,
    signOut: async () => {
      clearCachedUser()
      await signOut()
      window.location.href = "/"
    },
  }
}

// Keep AuthProvider as a no-op wrapper for backward compatibility
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
