"use client"

import {
  TrendingUp, PieChart, Lock, Shield, ShieldCheck, Landmark, Heart, Award, Gem,
  CircleDot, Home, Bitcoin, Wallet, RefreshCw, FileText, Receipt, Umbrella,
  ShieldPlus, Globe, Globe2, Banknote, MoreHorizontal, Car, User, GraduationCap,
  CreditCard, ShoppingCart, Zap, UtensilsCrossed, Stethoscope, Film, ShoppingBag,
  Repeat, Sparkles, Plane, Gift, Briefcase, Laptop, Building2, Percent, DollarSign,
  type LucideIcon,
} from "lucide-react"

const iconMap: Record<string, LucideIcon> = {
  TrendingUp, PieChart, Lock, Shield, ShieldCheck, Landmark, Heart, Award, Gem,
  CircleDot, Home, Bitcoin, Wallet, RefreshCw, FileText, Receipt, Umbrella,
  ShieldPlus, Globe, Globe2, Banknote, MoreHorizontal, Car, User, GraduationCap,
  CreditCard, ShoppingCart, Zap, UtensilsCrossed, Stethoscope, Film, ShoppingBag,
  Repeat, Sparkles, Plane, Gift, Briefcase, Laptop, Building2, Percent, DollarSign,
}

interface CategoryIconProps {
  name: string
  className?: string
  size?: "sm" | "md" | "lg"
}

export function CategoryIcon({ name, className, size = "md" }: CategoryIconProps) {
  const Icon = iconMap[name]
  const sizeClass = size === "sm" ? "w-3.5 h-3.5" : size === "lg" ? "w-6 h-6" : "w-4 h-4"
  
  if (!Icon) {
    return <MoreHorizontal className={className || sizeClass} />
  }
  
  return <Icon className={className || sizeClass} strokeWidth={1.5} />
}
