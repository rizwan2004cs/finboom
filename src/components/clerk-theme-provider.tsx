"use client"

import { ClerkProvider } from "@clerk/nextjs"
import { dark } from "@clerk/themes"
import { useEffect, useState } from "react"

function getIsDark() {
  if (typeof window === "undefined") return false
  return document.documentElement.classList.contains("dark")
}

export function ClerkThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setIsDark(getIsDark())

    const observer = new MutationObserver(() => {
      setIsDark(getIsDark())
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => observer.disconnect()
  }, [])

  const light = !isDark

  return (
    <ClerkProvider
      appearance={{
        baseTheme: isDark ? dark : undefined,
        variables: {
          colorPrimary: isDark ? "#f5f5f7" : "#1d1d1f",
          colorDanger: "#ff3b30",
          borderRadius: "1rem",
          fontFamily: "var(--font-sans), 'Inter', system-ui, sans-serif",
          fontSize: "0.875rem",
          spacingUnit: "1rem",
          ...(isDark
            ? {
                colorBackground: "#1c1c1e",
                colorText: "#f5f5f7",
                colorTextSecondary: "#98989d",
                colorInputBackground: "#2c2c2e",
                colorInputText: "#f5f5f7",
                colorNeutral: "#f5f5f7",
              }
            : {
                colorBackground: "#ffffff",
                colorText: "#1d1d1f",
                colorTextSecondary: "#6e6e73",
                colorInputBackground: "#f5f5f7",
                colorInputText: "#1d1d1f",
                colorNeutral: "#1d1d1f",
              }),
        },
        layout: {
          socialButtonsPlacement: "top",
          socialButtonsVariant: "blockButton",
          termsPageUrl: undefined,
          privacyPageUrl: undefined,
          shimmer: false,
        },
        elements: {
          rootBox: "!z-[100]",

          // --- Modal backdrop ---
          modalBackdrop: "!bg-black/40 !backdrop-blur-sm",
          modalContent: "!shadow-none",

          // --- Card shell ---
          card: [
            "!rounded-2xl !border !shadow-2xl",
            light
              ? "!bg-white/95 !backdrop-blur-xl !border-black/[0.08]"
              : "!bg-[#1c1c1e]/95 !backdrop-blur-xl !border-white/[0.08]",
          ].join(" "),
          cardBox: "!shadow-none",

          // --- Header ---
          headerTitle: [
            "!text-[18px] !font-semibold !tracking-[-0.3px]",
            light ? "!text-[#1d1d1f]" : "!text-white",
          ].join(" "),
          headerSubtitle: [
            "!text-[13px] !font-normal",
            light ? "!text-[#86868b]" : "!text-[#98989d]",
          ].join(" "),

          // --- Social button ---
          socialButtonsBlockButton: [
            "!rounded-xl !border !text-[14px] !font-medium !py-2.5 !transition-colors",
            light
              ? "!bg-[#f5f5f7] !border-black/[0.06] !text-[#1d1d1f] hover:!bg-[#ebebed]"
              : "!bg-[#2c2c2e] !border-white/[0.06] !text-white hover:!bg-[#3a3a3c]",
          ].join(" "),
          socialButtonsBlockButtonText: "!text-[14px] !font-medium",

          // --- Divider ---
          dividerLine: light ? "!bg-black/[0.08]" : "!bg-white/[0.08]",
          dividerText: [
            "!text-[12px] !uppercase !tracking-wider !font-medium",
            light ? "!text-[#86868b]" : "!text-[#636366]",
          ].join(" "),

          // --- Form fields ---
          formFieldLabel: [
            "!text-[13px] !font-medium",
            light ? "!text-[#1d1d1f]" : "!text-[#f5f5f7]",
          ].join(" "),
          formFieldInput: [
            "!rounded-xl !border !text-[14px] !py-2.5 !px-3.5 !transition-colors !shadow-none",
            light
              ? "!bg-[#f5f5f7] !border-black/[0.06] !text-[#1d1d1f] placeholder:!text-[#86868b] focus:!border-[#1d1d1f]/20 focus:!ring-1 focus:!ring-[#1d1d1f]/10"
              : "!bg-[#2c2c2e] !border-white/[0.06] !text-white placeholder:!text-[#636366] focus:!border-white/20 focus:!ring-1 focus:!ring-white/10",
          ].join(" "),
          formFieldAction: light ? "!text-[#6e6e73]" : "!text-[#98989d]",

          // --- Primary button ---
          formButtonPrimary: [
            "!rounded-xl !font-semibold !text-[14px] !py-2.5 !shadow-none !transition-all",
            light
              ? "!bg-[#1d1d1f] !text-white hover:!bg-[#3a3a3c] active:!scale-[0.98]"
              : "!bg-white !text-[#1d1d1f] hover:!bg-[#e8e8ed] active:!scale-[0.98]",
          ].join(" "),

          // --- Alternative methods ---
          alternativeMethodsBlockButton: [
            "!rounded-xl !border !text-[13px]",
            light
              ? "!text-[#1d1d1f] !border-black/[0.06] hover:!bg-[#f5f5f7]"
              : "!text-white !border-white/[0.06] hover:!bg-[#2c2c2e]",
          ].join(" "),

          // --- Identity preview ---
          identityPreview: [
            "!rounded-xl !border",
            light ? "!bg-[#f5f5f7] !border-black/[0.06]" : "!bg-[#2c2c2e] !border-white/[0.06]",
          ].join(" "),
          identityPreviewText: light ? "!text-[#1d1d1f]" : "!text-white",
          identityPreviewEditButton: light ? "!text-[#6e6e73]" : "!text-[#98989d]",

          // --- Close button ---
          modalCloseButton: light
            ? "!text-[#86868b] hover:!text-[#1d1d1f]"
            : "!text-[#636366] hover:!text-white",

          // --- Footer (sign in ↔ sign up toggle) ---
          footer: [
            "!border-t-0 !py-3 !bg-transparent",
          ].join(" "),
          footerActionText: [
            "!text-[13px]",
            light ? "!text-[#86868b]" : "!text-[#636366]",
          ].join(" "),
          footerActionLink: [
            "!text-[13px] !font-semibold !no-underline",
            light ? "!text-[#1d1d1f] hover:!text-[#3a3a3c]" : "!text-white hover:!text-[#98989d]",
          ].join(" "),

          // --- Clerk branding / dev badge ---
          badge: "!hidden",
          logoBox: "!hidden",
          footerPages: "!hidden",
          footerPagesLink: "!hidden",

          // --- User button popover ---
          userButtonPopoverCard: [
            "!rounded-2xl !border !shadow-xl",
            light
              ? "!bg-white/95 !backdrop-blur-xl !border-black/[0.08]"
              : "!bg-[#1c1c1e]/95 !backdrop-blur-xl !border-white/[0.08]",
          ].join(" "),
          userButtonPopoverActionButton: [
            "!rounded-xl !transition-colors",
            light ? "!text-[#1d1d1f] hover:!bg-[#f5f5f7]" : "!text-white hover:!bg-[#2c2c2e]",
          ].join(" "),
          userButtonPopoverActionButtonText: light ? "!text-[#1d1d1f]" : "!text-white",
          userButtonPopoverActionButtonIcon: light ? "!text-[#6e6e73]" : "!text-[#98989d]",
          userButtonPopoverFooter: "!hidden",
        },
      }}
    >
      {children}
    </ClerkProvider>
  )
}
