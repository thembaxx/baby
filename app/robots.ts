import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.APP_URL || "https://kora-nursery.app";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/llm.txt", "/llms.txt"],
        disallow: ["/api/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
