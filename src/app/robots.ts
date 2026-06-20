import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Keep app-only and non-indexable routes out of search results.
        disallow: [
          "/dashboard/",
          "/api/",
          "/login",
          "/auth",
          "/blog/new",
          "/blog/automation",
          "/tour-preview",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
