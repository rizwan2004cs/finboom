import { NextResponse } from "next/server"
import { requireEditorRole } from "@/lib/blog/admin-auth"
import { getBlogAutomationStatus } from "@/lib/blog/automation-status"

export async function GET() {
  const denied = await requireEditorRole()
  if (denied) {
    return NextResponse.json({ error: denied.error }, { status: denied.status })
  }

  const status = await getBlogAutomationStatus()
  return NextResponse.json(status)
}
