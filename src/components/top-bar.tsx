"use client"

import { Show, UserButton, SignInButton } from "@clerk/nextjs"
import { Bell, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { useSidebar } from "@/components/sidebar-context"

export function TopBar() {
  const { collapsed, toggle } = useSidebar()

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between h-12 px-4 lg:px-8 glass-elevated">
      <div className="flex items-center gap-2">
        <div className="lg:hidden">
          <span className="text-[17px] font-semibold tracking-[-0.3px] text-[#1d1d1f]">FinBoom</span>
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
        <button className="relative p-2 rounded-full hover:bg-white/60 transition-all duration-200">
          <Bell className="w-[18px] h-[18px] text-[#86868b]" strokeWidth={1.5} />
        </button>
        
        <Show when="signed-in">
          <UserButton 
            appearance={{
              elements: {
                avatarBox: "w-8 h-8"
              }
            }}
          />
        </Show>
        <Show when="signed-out">
          <SignInButton mode="modal">
            <button className="px-4 py-1.5 text-sm font-medium text-white bg-[#1d1d1f] rounded-full hover:bg-[#2d2d2f] transition-all duration-200">
              Sign In
            </button>
          </SignInButton>
        </Show>
      </div>
    </header>
  )
}
