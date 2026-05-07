"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

interface SidebarContextType {
  collapsed: boolean
  toggle: () => void
}

const SidebarContext = createContext<SidebarContextType>({ collapsed: false, toggle: () => {} })

export function useSidebar() {
  return useContext(SidebarContext)
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed")
    if (stored === "true") setCollapsed(true)
  }, [])

  const toggle = () => {
    setCollapsed(prev => {
      localStorage.setItem("sidebar-collapsed", String(!prev))
      return !prev
    })
  }

  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  )
}
