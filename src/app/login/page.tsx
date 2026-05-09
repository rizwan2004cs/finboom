"use client"

import { SignIn, SignUp, useClerk } from "@clerk/nextjs"
import { useState } from "react"
import Link from "next/link"

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const { loaded } = useClerk()

  const clerkAppearance = {
    elements: {
      rootBox: "w-full",
      cardBox: "shadow-none w-full",
      card: "clerk-glass-card !rounded-3xl !shadow-none w-full !border-0 !bg-transparent",
      headerTitle: "!text-[#1d1d1f] dark:!text-white !font-semibold !text-lg",
      headerSubtitle: "!text-[#86868b] !text-sm",
      socialButtonsBlockButton:
        "!rounded-2xl !bg-white/60 dark:!bg-white/[0.08] !border !border-black/[0.06] dark:!border-white/[0.1] !backdrop-blur-md !shadow-sm hover:!shadow-md !transition-all hover:!scale-[1.02] hover:!bg-white/80 dark:hover:!bg-white/[0.12]",
      socialButtonsBlockButtonText: "!text-[#1d1d1f] dark:!text-white !font-medium",
      dividerLine: "!bg-black/[0.08] dark:!bg-white/[0.1]",
      dividerText: "!text-[#86868b] !text-xs",
      formFieldLabel: "!text-[#1d1d1f] dark:!text-[#e5e5e7] !font-medium !text-sm",
      formFieldInput:
        "!rounded-2xl !bg-white/60 dark:!bg-white/[0.06] !border !border-black/[0.08] dark:!border-white/[0.1] !backdrop-blur-sm !text-[#1d1d1f] dark:!text-white placeholder:!text-[#86868b]/60 focus:!ring-2 focus:!ring-black/[0.08] dark:focus:!ring-white/[0.15] focus:!border-transparent !transition-all !shadow-sm !h-12",
      formButtonPrimary:
        "!rounded-2xl !bg-[#1d1d1f] dark:!bg-white !text-white dark:!text-[#1d1d1f] !font-semibold !shadow-lg hover:!shadow-xl !transition-all hover:!scale-[1.02] active:!scale-[0.98] !h-12 !text-[15px]",
      footer: "hidden",
      alternativeMethods: "hidden",
      logoBox: "hidden",
      internal: "!font-[var(--font-sans)]",
    },
    layout: {
      socialButtonsPlacement: "top" as const,
      logoPlacement: "none" as const,
    },
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#e8eaf0] via-[#f0eef5] to-[#eaf4f0] dark:from-[#0a0a0a] dark:via-[#111113] dark:to-[#0d0d0f] mesh-bg px-4">
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold tracking-[-0.5px] text-[#1d1d1f] dark:text-white">
            FinBoom
          </Link>
          <p className="mt-2 text-[#86868b] text-sm">
            {mode === "signin" ? "Sign in to track your wealth" : "Create your account"}
          </p>
        </div>

        {/* Clerk component */}
        <div className="flex justify-center">
          {!loaded ? (
            <div className="w-full clerk-glass-card rounded-3xl p-8 animate-pulse">
              <div className="flex flex-col items-center gap-4">
                <div className="w-full h-12 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06]" />
                <div className="flex items-center gap-3 w-full my-1">
                  <div className="flex-1 h-px bg-black/[0.06] dark:bg-white/[0.06]" />
                  <div className="h-3 w-6 rounded bg-black/[0.04] dark:bg-white/[0.04]" />
                  <div className="flex-1 h-px bg-black/[0.06] dark:bg-white/[0.06]" />
                </div>
                <div className="w-full h-12 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06]" />
                <div className="w-full h-12 rounded-2xl bg-black/[0.08] dark:bg-white/[0.08]" />
              </div>
            </div>
          ) : mode === "signin" ? (
            <SignIn
              routing="hash"
              forceRedirectUrl="/dashboard"
              appearance={clerkAppearance}
            />
          ) : (
            <SignUp
              routing="hash"
              forceRedirectUrl="/dashboard"
              appearance={clerkAppearance}
            />
          )}
        </div>

        {/* Toggle sign in / sign up — only show once Clerk is loaded */}
        {loaded && (
          <>
            <p className="text-[13px] text-[#86868b] text-center mt-6">
              {mode === "signin" ? "Don\u2019t have an account?" : "Already have an account?"}{" "}
              <button
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                className="text-[#1d1d1f] dark:text-white font-semibold hover:underline transition-colors"
              >
                {mode === "signin" ? "Sign up" : "Sign in"}
              </button>
            </p>

            <p className="text-[10px] text-[#86868b]/50 text-center mt-4">
              By signing in, you agree to our terms of use and privacy policy.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
