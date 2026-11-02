import type { MetadataRoute } from "next";

import { ICON_COLORS } from "@/lib/app-icon";
import { SITE } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    categories: ["games", "entertainment", "utilities"],
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    // The splash screen while the app opens: the icon's yellow.
    background_color: ICON_COLORS.background,
    theme_color: "#000000",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/pwa-icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icons/512-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press on the home-screen icon: straight to a tab.
    shortcuts: [
      { name: "Rankings", short_name: "Rankings", description: "Hot and top-ranked board games", url: "/rankings" },
      { name: "Search", short_name: "Search", description: "Find any board game by name", url: "/search" },
      { name: "History", short_name: "History", description: "The games you scanned", url: "/history" },
    ],
  };
}
