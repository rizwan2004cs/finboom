import type { MetadataRoute } from "next";
import { sanityClient } from "@/lib/sanity";
import { SITE_URL } from "@/lib/site";
import { TOOLS } from "@/lib/tools";

// Revalidate hourly so daily auto-published posts appear without a redeploy.
export const revalidate = 3600;

type SitemapPost = {
  slug: string;
  publishedAt?: string;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/tools`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...TOOLS.map((tool) => ({
      url: `${baseUrl}/tools/${tool.slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];

  let posts: SitemapPost[] = [];
  try {
    posts = await sanityClient.fetch(
      `*[_type == "post" && defined(slug.current)] | order(publishedAt desc) {
        "slug": slug.current,
        publishedAt
      }`
    );
  } catch {
    // Sanity unreachable - still serve the static entries.
    return staticEntries;
  }

  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: post.publishedAt ? new Date(post.publishedAt) : new Date(),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticEntries, ...postEntries];
}
