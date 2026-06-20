// Uploads an external image URL into Sanity's asset store so it can be used
// as a post's mainImage (hero + blog card + OG image). Returns null on any
// failure so a missing hero never blocks publishing the post.
//
// Shared by the daily automation pipeline and the manual publish route.
export type SanityImageRef = {
  _type: "image"
  asset: { _type: "reference"; _ref: string }
}

export async function uploadHeroImageToSanity(
  imageUrl: string
): Promise<SanityImageRef | null> {
  const token = process.env.SANITY_EDITOR_TOKEN
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET
  if (!token || !projectId || !dataset) return null

  try {
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) return null
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg"
    const buffer = Buffer.from(await imageResponse.arrayBuffer())

    const uploadResponse = await fetch(
      `https://${projectId}.api.sanity.io/v2024-01-01/assets/images/${dataset}?filename=hero.jpg`,
      {
        method: "POST",
        headers: {
          "Content-Type": contentType,
          Authorization: `Bearer ${token}`,
        },
        body: buffer,
      }
    )
    const data = await uploadResponse.json()
    const assetId = data?.document?._id
    if (!uploadResponse.ok || !assetId) return null

    return { _type: "image", asset: { _type: "reference", _ref: assetId } }
  } catch {
    return null
  }
}
