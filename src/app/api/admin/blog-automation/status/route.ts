import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { getBlogAutomationStatus } from "@/lib/blog/automation-status"

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const role = (user.publicMetadata as { role?: string })?.role

  if (role !== "admin" && role !== "editor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const status = await getBlogAutomationStatus()
  return NextResponse.json(status)
}

