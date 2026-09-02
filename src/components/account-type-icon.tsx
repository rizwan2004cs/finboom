"use client"

import { Banknote, CreditCard, Landmark } from "lucide-react"
import type { Account } from "@/lib/types"

interface AccountTypeIconProps {
  type: Account["type"]
  className?: string
  strokeWidth?: number
}

/** One icon per account type so every list draws cards, cash and banks alike. */
export function AccountTypeIcon({ type, className = "w-4 h-4", strokeWidth = 1.5 }: AccountTypeIconProps) {
  const Icon = type === "credit_card" ? CreditCard : type === "cash" ? Banknote : Landmark
  return <Icon className={className} strokeWidth={strokeWidth} />
}
