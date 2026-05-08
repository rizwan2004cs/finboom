"use client"

import Link from "next/link"
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs"

export function NavAuthButtons() {
  const { isSignedIn } = useAuth()

  if (isSignedIn) {
    return (
      <>
        <Link href="/dashboard" className="liquid-glass-btn-primary px-5 py-1.5 text-sm">
          Dashboard
        </Link>
        <UserButton />
      </>
    )
  }

  return (
    <SignInButton mode="modal">
      <button className="liquid-glass-btn-primary px-5 py-1.5 text-sm cursor-pointer">
        Sign in
      </button>
    </SignInButton>
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
    <SignInButton mode="modal">
      <button className="liquid-glass-btn-primary px-7 py-3 text-[17px] cursor-pointer">
        Get Started — It&apos;s Free
      </button>
    </SignInButton>
  )
}
