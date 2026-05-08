"use client"

import { Sidebar, MobileBottomNav } from "@/components/navigation"
import { TopBar } from "@/components/top-bar"
import { SidebarProvider, useSidebar } from "@/components/sidebar-context"
import { OfflineProvider } from "@/components/offline-provider"
import { cn } from "@/lib/utils"

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar()

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e8eaf0] via-[#f0eef5] to-[#eaf4f0] dark:from-[#0a0a0a] dark:via-[#111113] dark:to-[#0d0d0f] mesh-bg">
      <Sidebar />
      <div className={cn(
        "flex flex-col min-h-screen transition-all duration-300 ease-in-out",
        collapsed ? "lg:pl-[72px]" : "lg:pl-[260px]"
      )}>
        <TopBar />
        <main className="flex-1 p-4 lg:p-8 pb-24 lg:pb-8">
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <OfflineProvider>
        <DashboardShell>{children}</DashboardShell>
      </OfflineProvider>
    </SidebarProvider>
  )
}
