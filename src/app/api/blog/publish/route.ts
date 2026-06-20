import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { uploadHeroImageToSanity } from "@/lib/blog/sanity-image"

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

  const token = process.env.SANITY_EDITOR_TOKEN
  if (!token) {
    return NextResponse.json({ error: "Sanity token not configured on server" }, { status: 500 })
  }

  const body = await request.json()
  const { post } = body

  if (!post?._type || !post?.title || !post?.body) {
    return NextResponse.json({ error: "Missing required post fields" }, { status: 400 })
  }

  // Manually-created posts carry a transient heroImageUrl from generation.
  // Upload it into Sanity as the real mainImage (so cards/hero/OG render a
  // proper photo instead of falling back to a gradient), then drop the
  // transient fields before persisting.
  if (!post.mainImage && typeof post.heroImageUrl === "string" && post.heroImageUrl) {
    const mainImage = await uploadHeroImageToSanity(post.heroImageUrl)
    if (mainImage) post.mainImage = mainImage
  }
  delete post.heroImageUrl
  delete post.heroImageAlt

  const res = await fetch(
    `https://${process.env.NEXT_PUBLIC_SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/mutate/${process.env.NEXT_PUBLIC_SANITY_DATASET}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ mutations: [{ create: post }] }),
    }
  )

  const data = await res.json()

  if (!res.ok) {
    return NextResponse.json(
      { error: data.error?.description || "Failed to publish" },
      { status: res.status }
    )
  }

  return NextResponse.json({ success: true, result: data })
}
