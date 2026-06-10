"use client"

import { useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, X } from "lucide-react"

export function BlogSearchBox({ initialQuery }: { initialQuery?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(initialQuery ?? "")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function navigate(query: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (query) {
      params.set("q", query)
    } else {
      params.delete("q")
    }
    const qs = params.toString()
    router.replace(qs ? `/blog?${qs}` : "/blog", { scroll: false })
  }

  function onChange(next: string) {
    setValue(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => navigate(next.trim()), 300)
  }

  function clear() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setValue("")
    navigate("")
  }

  return (
    <div className="relative mt-6 max-w-md">
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#86868b]"
        strokeWidth={2}
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search posts..."
        aria-label="Search blog posts"
        className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-[#f5f5f7] dark:bg-[#1c1c1e] py-2.5 pl-10 pr-10 text-[15px] text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:bg-white dark:focus:bg-black focus:outline-none focus:ring-2 focus:ring-accent/40 transition-colors [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          onClick={clear}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#86868b] hover:bg-black/[0.06] dark:hover:bg-white/[0.1] transition-colors"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      )}
    </div>
  )
}
