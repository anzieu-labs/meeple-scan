import type { MetadataRoute } from "next";

import { SITE } from "@/lib/site";

/** The app page is public; the API only serves the app. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
