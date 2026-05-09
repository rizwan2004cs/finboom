"use client"

import { useState, useEffect, useRef } from "react"
import { useUser, useAuth } from "@/hooks/use-auth"
import { PanelLeftClose, PanelLeftOpen, LogOut, ChevronDown } from "lucide-react"
import { useSidebar } from "@/components/sidebar-context"
import { useProfile } from "@/hooks/use-profile"
import { NotificationBell } from "@/components/notification-bell"
import Link from "next/link"

export function TopBar() {
  const { collapsed, toggle } = useSidebar()
  const { user, isSignedIn } = useUser()
  const { signOut } = useAuth()
  const { profiles, activeProfile, switchProfile } = useProfile()
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileSwitcherOpen, setProfileSwitcherOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const switcherRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!profileOpen && !profileSwitcherOpen) return
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setProfileSwitcherOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [profileOpen, profileSwitcherOpen])

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 lg:px-8 glass-elevated border-b border-black/[0.04] dark:border-white/[0.04]">
      <div className="flex items-center gap-2">
        <div className="lg:hidden">
          <p className="text-[17px] font-semibold tracking-[-0.3px] text-[#1d1d1f] leading-tight">
            {user ? `Hi, ${user.firstName || "there"}` : "FinBoom"}
          </p>
          <p className="text-[11px] text-[#86868b] leading-tight">FinBoom</p>
        </div>
        <button
          onClick={toggle}
          className="hidden lg:flex p-2 rounded-xl hover:bg-white/60 transition-all duration-200"
        >
          {collapsed ? (
            <PanelLeftOpen className="w-[18px] h-[18px] text-[#86868b]" strokeWidth={1.5} />
          ) : (
            <PanelLeftClose className="w-[18px] h-[18px] text-[#86868b]" strokeWidth={1.5} />
          )}
        </button>
      </div>
      
      <div className="flex items-center gap-2">
        {/* Profile Switcher */}
        {isSignedIn && profiles.length > 1 && activeProfile && (
          <div className="relative" ref={switcherRef}>
            <button
              onClick={() => setProfileSwitcherOpen(!profileSwitcherOpen)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl hover:bg-white/60 dark:hover:bg-white/[0.06] transition-all text-[13px] font-medium text-[#1d1d1f] dark:text-white"
            >
              <span className="max-w-[80px] truncate">{activeProfile.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#86868b]" />
            </button>
            {profileSwitcherOpen && (
              <div className="absolute right-0 top-full mt-2 w-44 rounded-xl bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-xl shadow-2xl shadow-black/[0.12] border border-black/[0.06] dark:border-white/[0.08] overflow-hidden z-50">
                <div className="px-3 py-2 border-b border-black/[0.04] dark:border-white/[0.06]">
                  <p className="text-[11px] font-medium text-[#86868b] uppercase tracking-wider">Switch Profile</p>
                </div>
                {profiles.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { switchProfile(p.id); setProfileSwitcherOpen(false) }}
                    className={`flex items-center gap-2 w-full px-3 py-2.5 text-left text-[13px] transition-colors ${
                      p.id === activeProfile.id
                        ? "text-[#1d1d1f] dark:text-white bg-black/[0.04] dark:bg-white/[0.06] font-medium"
                        : "text-[#515154] dark:text-[#98989d] hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: p.id === activeProfile.id ? "#34c759" : "transparent" }} />
                    <span className="truncate">{p.name}</span>
                    <span className="text-[10px] text-[#86868b] ml-auto capitalize">{p.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <NotificationBell />
        
        {isSignedIn ? (
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="rounded-full transition-all duration-200 hover:ring-2 hover:ring-black/10 dark:hover:ring-white/20"
            >
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#1d1d1f] text-white flex items-center justify-center text-sm font-medium">
                  {user?.firstName?.[0] || "?"}
                </div>
              )}
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-xl shadow-2xl shadow-black/[0.12] border border-black/[0.06] dark:border-white/[0.08] overflow-hidden z-50">
                <div className="px-3 py-2.5 border-b border-black/[0.04] dark:border-white/[0.06]">
                  <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white truncate">
                    {user?.fullName || user?.firstName || "User"}
                  </p>
                  <p className="text-[11px] text-[#86868b] truncate">
                    {user?.email || ""}
                  </p>
                </div>
                <button
                  onClick={() => { setProfileOpen(false); signOut() }}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 text-left text-[13px] text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" strokeWidth={1.5} />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="px-4 py-1.5 text-sm font-medium text-white bg-[#1d1d1f] rounded-full hover:bg-[#2d2d2f] transition-all duration-200"
          >
            Sign In
          </Link>
        )}
      </div>
    </header>
  )
}
