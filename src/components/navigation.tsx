"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useSidebar } from "@/components/sidebar-context"
import {
  LayoutDashboard,
  Wallet,
  ArrowUpDown,
  Target,
  Camera,
  Heart,
  Users,
  Settings,
  CreditCard,
  PanelLeftClose,
  PanelLeftOpen,
  HandCoins,
  MoreHorizontal,
  X,
  BookOpen,
  PiggyBank,
  Map,
} from "lucide-react"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/assets", label: "Assets", icon: Wallet },
  { href: "/dashboard/liabilities", label: "Liabilities", icon: CreditCard },
  { href: "/dashboard/transactions", label: "Transactions", icon: ArrowUpDown },
  { href: "/dashboard/budget", label: "Budget", icon: PiggyBank },
  { href: "/dashboard/parties", label: "Parties", icon: HandCoins },
  { href: "/dashboard/goals", label: "Goals", icon: Target },
  { href: "/dashboard/snapshots", label: "Snapshots", icon: Camera },
  { href: "/dashboard/health", label: "Health", icon: Heart },
  { href: "/blog", label: "Blog", icon: BookOpen },
  { href: "/dashboard/profiles", label: "Profiles", icon: Users },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
]

const mobileNavItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard/assets", label: "Assets", icon: Wallet },
  { href: "/dashboard/transactions", label: "Track", icon: ArrowUpDown },
  { href: "/dashboard/liabilities", label: "Loans", icon: CreditCard },
]

// Pages that should highlight the "More" tab
const moreSubPages = [
  "/dashboard/budget",
  "/dashboard/parties",
  "/dashboard/goals",
  "/dashboard/snapshots",
  "/dashboard/health",
  "/dashboard/profiles",
  "/dashboard/settings",
  "/blog",
]

const moreSheetItems = [
  { href: "/dashboard/budget", label: "Budget", icon: PiggyBank },
  { href: "/dashboard/parties", label: "Parties", icon: HandCoins },
  { href: "/dashboard/goals", label: "Goals", icon: Target },
  { href: "/dashboard/snapshots", label: "Snapshots", icon: Camera },
  { href: "/dashboard/health", label: "Health", icon: Heart },
  { href: "/blog", label: "Blog", icon: BookOpen },
  { href: "/dashboard/profiles", label: "Profiles", icon: Users },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
]

// Tour button item (handled via callback, not a link)
const tourItem = { label: "Tour", icon: Map }

export function Sidebar({ onStartTour }: { onStartTour?: () => void }) {
  const pathname = usePathname()
  const { collapsed, toggle } = useSidebar()

  return (
    <aside
      className={cn(
        "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 glass-elevated border-r border-black/[0.04] dark:border-white/[0.04] transition-all duration-300 ease-in-out",
        collapsed ? "lg:w-[72px]" : "lg:w-[260px]"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center h-12", collapsed ? "justify-center px-2" : "gap-2.5 px-6")}>
        {!collapsed && (
          <span className="text-[17px] font-semibold tracking-[-0.3px] text-[#1d1d1f]">FinBoom</span>
        )}
        {collapsed && (
          <span className="text-[17px] font-bold text-[#1d1d1f]">F</span>
        )}
      </div>

      {/* Nav items */}
      <nav className={cn("flex-1 py-2 space-y-0.5 overflow-y-auto", collapsed ? "px-2" : "px-3")}>
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/dashboard" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={item.label.toLowerCase()}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl text-[14px] font-medium transition-all duration-200",
                collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2",
                isActive
                  ? "bg-white/70 text-[#1d1d1f] shadow-sm shadow-black/[0.06] backdrop-blur-sm"
                  : "text-[#6e6e73] hover:bg-white/50 hover:text-[#1d1d1f]"
              )}
            >
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}

        {/* Tour button */}
        {onStartTour && (
          <button
            onClick={onStartTour}
            title={collapsed ? tourItem.label : undefined}
            className={cn(
              "flex items-center gap-3 w-full rounded-xl text-[14px] font-medium transition-all duration-200",
              collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2",
              "text-[#6e6e73] hover:bg-white/50 hover:text-[#1d1d1f]"
            )}
          >
            <tourItem.icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
            {!collapsed && <span>{tourItem.label}</span>}
          </button>
        )}
      </nav>

      {/* Collapse toggle */}
      <div className={cn("py-3 border-t border-white/20", collapsed ? "px-2" : "px-3")}>
        <button
          onClick={toggle}
          className={cn(
            "flex items-center gap-3 w-full rounded-xl text-[14px] font-medium text-[#86868b] hover:text-[#1d1d1f] hover:bg-white/50 transition-all duration-200",
            collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2"
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="w-[18px] h-[18px]" strokeWidth={1.5} />
          ) : (
            <>
              <PanelLeftClose className="w-[18px] h-[18px]" strokeWidth={1.5} />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}

export function MobileBottomNav({ onStartTour }: { onStartTour?: () => void }) {
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)

  const isMoreActive = moreSubPages.some(p => pathname === p || pathname.startsWith(p))

  // Close sheet on navigation
  useEffect(() => {
    setSheetOpen(false)
  }, [pathname])

  // Close on click outside
  useEffect(() => {
    if (!sheetOpen) return
    function handleClick(e: MouseEvent) {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        setSheetOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [sheetOpen])

  return (
    <>
      {/* Backdrop */}
      {sheetOpen && (
        <div
          className="lg:hidden fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-200"
          onClick={() => setSheetOpen(false)}
        />
      )}

      {/* Slide-up sheet */}
      <div
        ref={sheetRef}
        className={cn(
          "lg:hidden fixed left-0 right-0 bottom-0 z-[70] transition-transform duration-300 ease-out",
          sheetOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="rounded-t-2xl bg-[#f5f5f7] dark:bg-[#1c1c1e] shadow-2xl shadow-black/20 border-t border-x border-black/[0.06] dark:border-white/[0.08] overflow-hidden pb-[env(safe-area-inset-bottom)]">
          {/* Drag handle */}
          <div className="flex flex-col items-center pt-2">
            <div className="w-9 h-1 rounded-full bg-[#d1d1d6] dark:bg-[#48484a] mb-2" />
          </div>
          <div className="flex items-center justify-between px-5 pb-2">
            <span className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">More</span>
            <button
              onClick={() => setSheetOpen(false)}
              className="p-1.5 rounded-full bg-[#e5e5ea] dark:bg-[#38383a]"
            >
              <X className="w-3.5 h-3.5 text-[#3a3a3c] dark:text-[#aeaeb2]" strokeWidth={2.5} />
            </button>
          </div>

          {/* Grid of items */}
          <div className="grid grid-cols-3 gap-2 px-4 pb-4">
            {moreSheetItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-2 py-4 rounded-xl transition-all duration-150 active:scale-95",
                    isActive
                      ? "bg-[#1d1d1f] dark:bg-white"
                      : "bg-white dark:bg-[#2c2c2e] hover:bg-[#e5e5ea] dark:hover:bg-[#38383a]"
                  )}
                >
                  <item.icon
                    className={cn(
                      "w-[22px] h-[22px]",
                      isActive
                        ? "text-white dark:text-[#1d1d1f]"
                        : "text-[#3a3a3c] dark:text-[#aeaeb2]"
                    )}
                    strokeWidth={1.5}
                  />
                  <span
                    className={cn(
                      "text-[11px] font-medium",
                      isActive
                        ? "text-white dark:text-[#1d1d1f]"
                        : "text-[#3a3a3c] dark:text-[#aeaeb2]"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              )
            })}

            {/* Tour button */}
            {onStartTour && (
              <button
                onClick={() => { setSheetOpen(false); onStartTour() }}
                className="flex flex-col items-center gap-2 py-4 rounded-xl transition-all duration-150 active:scale-95 bg-white dark:bg-[#2c2c2e] hover:bg-[#e5e5ea] dark:hover:bg-[#38383a]"
              >
                <tourItem.icon
                  className="w-[22px] h-[22px] text-[#3a3a3c] dark:text-[#aeaeb2]"
                  strokeWidth={1.5}
                />
                <span className="text-[11px] font-medium text-[#3a3a3c] dark:text-[#aeaeb2]">
                  {tourItem.label}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom nav bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 glass-elevated bottom-nav">
        <div className="flex items-center justify-around py-2">
          {mobileNavItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                data-tour-mobile={item.label.toLowerCase()}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-all duration-200 min-w-[60px]",
                  isActive ? "text-[#1d1d1f]" : "text-[#86868b]"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive && "scale-110")} strokeWidth={1.5} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            )
          })}

          {/* More button */}
          <button
            onClick={() => setSheetOpen(!sheetOpen)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-all duration-200 min-w-[60px]",
              isMoreActive || sheetOpen ? "text-[#1d1d1f]" : "text-[#86868b]"
            )}
          >
            <MoreHorizontal className={cn("w-5 h-5", (isMoreActive || sheetOpen) && "scale-110")} strokeWidth={1.5} />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  )
}
