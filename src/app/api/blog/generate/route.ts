import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { generateBlogFromTopic } from "@/lib/blog/ai-generation"
import { getUsedImageKeys, saveUsedImages } from "@/lib/blog/used-images"

export async function POST(request: Request) {
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

  const body = await request.json()
  const { topic } = body

  if (!topic?.trim()) {
    return NextResponse.json({ error: "Topic is required" }, { status: 400 })
  }

  try {
    // Seed with previously used photos so manual posts don't repeat images
    // either; record immediately (a discarded preview over-blocks a few
    // photos, which is harmless against the size of the stock-photo pool).
    const generated = await generateBlogFromTopic(topic.trim(), {
      usedImageKeys: await getUsedImageKeys(),
    })
    await saveUsedImages(generated.usedImages ?? [])
    return NextResponse.json(generated)
  } catch (err: unknown) {
    console.error("Blog generation error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate blog post" },
      { status: 500 }
    )
  }
}
