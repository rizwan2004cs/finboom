"use client"

import { Sidebar, MobileBottomNav } from "@/components/navigation"
import { AssistantChat } from "@/components/assistant/assistant-chat"
import { TopBar } from "@/components/top-bar"
import { SidebarProvider, useSidebar } from "@/components/sidebar-context"
import { OfflineProvider } from "@/components/offline-provider"
import { ProfileProvider } from "@/hooks/use-profile"
import { CurrencyProvider } from "@/hooks/use-currency"
import { QueryProvider } from "@/components/query-provider"
import { usePushSubscription } from "@/hooks/use-push"
import { AppDialogProvider } from "@/components/app-dialog"
import { ToastProvider } from "@/components/toast"
import { WriteErrorToaster } from "@/components/write-error-toaster"
import { FeatureTour, useFeatureTour } from "@/components/feature-tour"
import { PinLockGate } from "@/components/pin-lock"
import { cn } from "@/lib/utils"

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar()
  const { open, startTour, closeTour } = useFeatureTour()
  usePushSubscription()

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e8eaf0] via-[#f0eef5] to-[#eaf4f0] dark:from-[#0a0a0a] dark:via-[#111113] dark:to-[#0d0d0f] mesh-bg">
      <Sidebar onStartTour={startTour} />
      <div className={cn(
        "flex flex-col min-h-screen transition-all duration-300 ease-in-out",
        collapsed ? "lg:pl-[72px]" : "lg:pl-[260px]"
      )}>
        <TopBar />
        <main className="flex-1 p-4 lg:p-8 pb-24 lg:pb-8">
          {children}
        </main>
      </div>
      <MobileBottomNav onStartTour={startTour} />
      <AssistantChat />
      <FeatureTour open={open} onClose={closeTour} />
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <QueryProvider>
      <ToastProvider>
        <WriteErrorToaster />
        <AppDialogProvider>
          <SidebarProvider>
            <OfflineProvider>
              <ProfileProvider>
                <CurrencyProvider>
                  <PinLockGate>
                    <DashboardShell>{children}</DashboardShell>
                  </PinLockGate>
                </CurrencyProvider>
              </ProfileProvider>
            </OfflineProvider>
          </SidebarProvider>
        </AppDialogProvider>
      </ToastProvider>
    </QueryProvider>
  )
}
