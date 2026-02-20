import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/docs/", "/blog/"],
        disallow: ["/dashboard/", "/api/", "/auth/"],
      },
    ],
    sitemap: "https://pincerpay.com/sitemap.xml",
  };
}
