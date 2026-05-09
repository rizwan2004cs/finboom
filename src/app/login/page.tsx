"use client"

import { SignIn, SignUp, useClerk } from "@clerk/nextjs"
import { useState } from "react"
import Link from "next/link"

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const { loaded } = useClerk()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#e8eaf0] via-[#f0eef5] to-[#eaf4f0] dark:from-[#0a0a0a] dark:via-[#111113] dark:to-[#0d0d0f] mesh-bg px-4">
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="text-center mb-6">
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
            <div className="w-full liquid-glass rounded-2xl p-8 animate-pulse">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-black/[0.06] dark:bg-white/[0.06]" />
                <div className="h-5 w-40 rounded bg-black/[0.06] dark:bg-white/[0.06]" />
                <div className="h-3 w-52 rounded bg-black/[0.04] dark:bg-white/[0.04]" />
                <div className="w-full h-11 rounded-xl bg-black/[0.06] dark:bg-white/[0.06] mt-2" />
                <div className="flex items-center gap-3 w-full my-1">
                  <div className="flex-1 h-px bg-black/[0.06] dark:bg-white/[0.06]" />
                  <div className="h-3 w-6 rounded bg-black/[0.04] dark:bg-white/[0.04]" />
                  <div className="flex-1 h-px bg-black/[0.06] dark:bg-white/[0.06]" />
                </div>
                <div className="w-full h-11 rounded-xl bg-black/[0.06] dark:bg-white/[0.06]" />
                <div className="w-full h-11 rounded-xl bg-black/[0.08] dark:bg-white/[0.08]" />
              </div>
            </div>
          ) : mode === "signin" ? (
            <SignIn
              routing="hash"
              forceRedirectUrl="/dashboard"
              appearance={{
                elements: {
                  rootBox: "w-full",
                  cardBox: "shadow-none w-full",
                  card: "liquid-glass rounded-2xl shadow-none w-full",
                  socialButtonsBlockButton: "liquid-glass-btn rounded-xl",
                  formFieldInput: "rounded-xl bg-white/50 dark:bg-white/[0.06] border-black/[0.06] dark:border-white/[0.08]",
                  formButtonPrimary: "liquid-glass-btn-primary rounded-xl",
                  footerAction: "hidden",
                },
              }}
            />
          ) : (
            <SignUp
              routing="hash"
              forceRedirectUrl="/dashboard"
              appearance={{
                elements: {
                  rootBox: "w-full",
                  cardBox: "shadow-none w-full",
                  card: "liquid-glass rounded-2xl shadow-none w-full",
                  socialButtonsBlockButton: "liquid-glass-btn rounded-xl",
                  formFieldInput: "rounded-xl bg-white/50 dark:bg-white/[0.06] border-black/[0.06] dark:border-white/[0.08]",
                  formButtonPrimary: "liquid-glass-btn-primary rounded-xl",
                  footerAction: "hidden",
                },
              }}
            />
          )}
        </div>

        {/* Toggle sign in / sign up — only show once Clerk is loaded */}
        {loaded && (
          <>
            <p className="text-[12px] text-[#86868b] text-center mt-5">
              {mode === "signin" ? "Don\u2019t have an account?" : "Already have an account?"}{" "}
              <button
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                className="text-blue-500 hover:text-blue-600 font-semibold transition-colors"
              >
                {mode === "signin" ? "Sign up" : "Sign in"}
              </button>
            </p>

            <p className="text-[10px] text-[#86868b]/60 text-center mt-4">
              By signing in, you agree to our terms of use and privacy policy.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
