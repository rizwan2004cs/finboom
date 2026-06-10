import { auth, clerkClient } from "@clerk/nextjs/server"

// Resolves the Clerk role check shared by all blog admin routes.
// Returns null when authorized, or an error payload to return as JSON.
export async function requireEditorRole(): Promise<{ error: string; status: number } | null> {
  const { userId } = await auth()
  if (!userId) {
    return { error: "Unauthorized", status: 401 }
  }

  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const role = (user.publicMetadata as { role?: string })?.role

  if (role !== "admin" && role !== "editor") {
    return { error: "Forbidden", status: 403 }
  }

  return null
}
