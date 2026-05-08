import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/dashboard"
  const type = searchParams.get("type")

  if (code) {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Redirect to reset-password page for recovery flows
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/auth/reset-password`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Auth error — redirect to login
  return NextResponse.redirect(`${origin}/login?error=auth`)
}
