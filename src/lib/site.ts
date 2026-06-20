// Single source of truth for the public base URL. Set NEXT_PUBLIC_SITE_URL
// in the environment (e.g. https://finboom.app) to override the default.
// Used by metadataBase, the sitemap, robots, the RSS feed, and JSON-LD so
// canonical/OG/structured-data URLs never drift apart.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://finboom-cyan.vercel.app"
).replace(/\/$/, "")

export const SITE_NAME = "FinBoom"

export function absoluteUrl(path = ""): string {
  if (!path) return SITE_URL
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`
}
