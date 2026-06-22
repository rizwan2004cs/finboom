"use client"

import { useEffect, useState, useRef } from "react"
import { Bell, Check, Trash2, HandCoins, Target, AlertTriangle, ArrowUpRight, Repeat } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { useUser } from "@/hooks/use-auth"
import { Tooltip } from "@/components/tooltip"
import type { AppNotification } from "@/lib/types"

const TYPE_ICONS: Record<string, typeof Bell> = {
  overdue_payment: AlertTriangle,
  due_approaching: HandCoins,
  goal_milestone: Target,
  large_transaction: ArrowUpRight,
  sip_reminder: Repeat,
}

const TYPE_COLORS: Record<string, string> = {
  overdue_payment: "text-red-500",
  due_approaching: "text-amber-500",
  goal_milestone: "text-green-500",
  large_transaction: "text-blue-500",
  sip_reminder: "text-indigo-500",
}

export function NotificationBell() {
  const { user } = useUser()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const unreadCount = notifications.filter((n) => !n.read).length

  useEffect(() => {
    if (!user) return
    loadNotifications()

    // Poll every 60 seconds
    const interval = setInterval(loadNotifications, 60_000)
    return () => clearInterval(interval)
  }, [user])

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  async function loadNotifications() {
    const supabase = createClient()
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(30)
    setNotifications((data as AppNotification[]) || [])
  }

  async function markRead(id: string) {
    const supabase = createClient()
    await supabase.from("notifications").update({ read: true }).eq("id", id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  async function markAllRead() {
    if (!user) return
    const supabase = createClient()
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  async function clearAll() {
    if (!user) return
    const supabase = createClient()
    await supabase.from("notifications").delete().eq("user_id", user.id)
    setNotifications([])
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  return (
    <div className="relative" ref={ref}>
      <Tooltip label={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "Notifications"} side="bottom">
        <button
          onClick={() => setOpen(!open)}
          aria-label="Notifications"
          className="relative p-2 rounded-full hover:bg-white/60 dark:hover:bg-white/[0.08] transition-all duration-200"
        >
          <Bell className="w-[18px] h-[18px] text-[#86868b]" strokeWidth={1.5} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </Tooltip>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 sm:w-72 max-h-[360px] rounded-2xl bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-xl shadow-2xl shadow-black/[0.12] border border-black/[0.06] dark:border-white/[0.08] overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-black/[0.04] dark:border-white/[0.06]">
            <h3 className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white">Notifications</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="p-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-white/[0.08] transition-all"
                  title="Mark all read"
                >
                  <Check className="w-3.5 h-3.5 text-[#86868b]" />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="p-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-white/[0.08] transition-all"
                  title="Clear all"
                >
                  <Trash2 className="w-3.5 h-3.5 text-[#86868b]" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[300px]">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-6 h-6 text-[#86868b]/40 mx-auto mb-2" />
                <p className="text-[11px] text-[#86868b]">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = TYPE_ICONS[n.type] || Bell
                const color = TYPE_COLORS[n.type] || "text-[#86868b]"
                return (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-white/40 dark:hover:bg-white/[0.04] transition-all ${
                      !n.read ? "bg-blue-50/50 dark:bg-blue-500/[0.05]" : ""
                    }`}
                  >
                    <div className={`mt-0.5 p-1.5 rounded-full bg-[#f5f5f7] dark:bg-white/[0.06] ${color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white leading-tight">
                        {n.title}
                      </p>
                      <p className="text-[12px] text-[#86868b] leading-tight mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                      <p className="text-[11px] text-[#86868b]/60 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.read && <span className="mt-2 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
