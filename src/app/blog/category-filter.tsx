"use client"

import Link from "next/link"

export function BlogCategoryFilter({
  categories,
  labels,
  active,
}: {
  categories: string[]
  labels: Record<string, string>
  active?: string
}) {
  if (categories.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/blog"
        className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
          !active
            ? "bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f]"
            : "bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d] hover:bg-[#e8e8ed] dark:hover:bg-[#3a3a3c]"
        }`}
      >
        All
      </Link>
      {categories.map((cat) => (
        <Link
          key={cat}
          href={`/blog?category=${cat}`}
          className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
            active === cat
              ? "bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f]"
              : "bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d] hover:bg-[#e8e8ed] dark:hover:bg-[#3a3a3c]"
          }`}
        >
          {labels[cat] || cat}
        </Link>
      ))}
    </div>
  )
}
