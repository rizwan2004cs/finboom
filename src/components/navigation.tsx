"use client"

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
} from "lucide-react"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/assets", label: "Assets", icon: Wallet },
  { href: "/dashboard/liabilities", label: "Liabilities", icon: CreditCard },
  { href: "/dashboard/transactions", label: "Transactions", icon: ArrowUpDown },
  { href: "/dashboard/goals", label: "Goals", icon: Target },
  { href: "/dashboard/snapshots", label: "Snapshots", icon: Camera },
  { href: "/dashboard/health", label: "Health", icon: Heart },
  { href: "/dashboard/profiles", label: "Profiles", icon: Users },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
]

const mobileNavItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard/assets", label: "Assets", icon: Wallet },
  { href: "/dashboard/transactions", label: "Track", icon: ArrowUpDown },
  { href: "/dashboard/liabilities", label: "Loans", icon: CreditCard },
  { href: "/dashboard/settings", label: "More", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { collapsed, toggle } = useSidebar()

  return (
    <aside
      className={cn(
        "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 glass-elevated transition-all duration-300 ease-in-out",
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

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 glass-elevated bottom-nav">
      <div className="flex items-center justify-around py-2">
        {mobileNavItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
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
      </div>
    </nav>
  )
}
