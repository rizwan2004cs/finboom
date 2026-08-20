import { BrandLoader } from "@/components/brand-loader"

// Blog pages fetch from Sanity on the server; without this boundary a
// navigation silently waits on the previous page and then "suddenly opens".
// Shows the FinBoom logo loader inside the dashboard shell instead.
export default function Loading() {
  return <BrandLoader />
}
