"use client"

import { useUser as useClerkUser, useAuth as useClerkAuth } from "@clerk/nextjs"

type AuthUser = {
  id: string
  email: string | undefined
  firstName: string | undefined
  fullName: string | undefined
  imageUrl: string | undefined
}

export function useUser() {
  const { user, isLoaded, isSignedIn } = useClerkUser()

  const mapped: AuthUser | null = user
    ? {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        firstName: user.firstName ?? undefined,
        fullName: user.fullName ?? undefined,
        imageUrl: user.imageUrl ?? undefined,
      }
    : null

  return { user: mapped, isLoaded, isSignedIn: isSignedIn ?? false }
}

export function useAuth() {
  const { isSignedIn, isLoaded, signOut } = useClerkAuth()
  return {
    isSignedIn: isSignedIn ?? false,
    isLoaded,
    signOut: async () => {
      await signOut()
      window.location.href = "/"
    },
  }
}

// Keep AuthProvider as a no-op wrapper for backward compatibility
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
