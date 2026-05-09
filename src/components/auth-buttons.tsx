"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"

export function AuthRedirect() {
  const { isSignedIn, isLoaded } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/dashboard")
    }
  }, [isLoaded, isSignedIn, router])

  return null
}

export function NavAuthButtons() {
  const { isSignedIn } = useAuth()

  if (isSignedIn) {
    return (
      <>
        <Link href="/dashboard" className="liquid-glass-btn-primary px-5 py-1.5 text-sm">
          Dashboard
        </Link>
      </>
    )
  }

  return (
    <Link href="/login" className="liquid-glass-btn-primary px-5 py-1.5 text-sm">
      Sign in
    </Link>
  )
}

export function HeroCTA() {
  const { isSignedIn } = useAuth()

  if (isSignedIn) {
    return (
      <Link href="/dashboard" className="liquid-glass-btn-primary px-7 py-3 text-[17px]">
        Go to Dashboard
      </Link>
    )
  }

  return (
    <Link href="/login" className="liquid-glass-btn-primary px-7 py-3 text-[17px]">
      Get Started — It&apos;s Free
    </Link>
  )
}
