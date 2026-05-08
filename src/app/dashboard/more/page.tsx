"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  HandCoins,
  Target,
  Camera,
  Heart,
  Users,
  Settings,
} from "lucide-react"

const moreItems = [
  { href: "/dashboard/parties", label: "Parties", icon: HandCoins, color: "text-emerald-600", bg: "bg-emerald-50" },
  { href: "/dashboard/goals", label: "Goals", icon: Target, color: "text-orange-600", bg: "bg-orange-50" },
  { href: "/dashboard/snapshots", label: "Snapshots", icon: Camera, color: "text-blue-600", bg: "bg-blue-50" },
  { href: "/dashboard/health", label: "Health", icon: Heart, color: "text-rose-600", bg: "bg-rose-50" },
  { href: "/dashboard/profiles", label: "Profiles", icon: Users, color: "text-violet-600", bg: "bg-violet-50" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, color: "text-gray-600", bg: "bg-gray-100" },
]

export default function MorePage() {
  const pathname = usePathname()

  return (
    <div className="max-w-lg mx-auto pt-2">
      <h1 className="text-xl font-semibold text-[#1d1d1f] mb-6">More</h1>

      <div className="grid grid-cols-3 gap-3">
        {moreItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-2.5 p-5 rounded-2xl transition-all duration-200 active:scale-95",
                "bg-white/70 backdrop-blur-sm shadow-sm shadow-black/[0.04]",
                "hover:shadow-md hover:bg-white/90",
                isActive && "ring-2 ring-[#1d1d1f]/10"
              )}
            >
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", item.bg)}>
                <item.icon className={cn("w-6 h-6", item.color)} strokeWidth={1.5} />
              </div>
              <span className="text-[13px] font-medium text-[#1d1d1f]">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
