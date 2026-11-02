import { ImageResponse } from "next/og";

import { ICON_COLORS, IconArt } from "@/lib/app-icon";
import { en } from "@/lib/i18n/dictionaries/en";
import { SITE } from "@/lib/site";

export const alt = SITE.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Link preview for chats and social networks: the icon's meeple and what the app does, on its yellow. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 56,
          padding: 88,
          background: ICON_COLORS.background,
          color: ICON_COLORS.frame,
        }}
      >
        <IconArt size={300} />
        <div style={{ display: "flex", flexDirection: "column", gap: 24, flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 88, fontWeight: 700 }}>{SITE.name}</div>
          <div style={{ fontSize: 38, lineHeight: 1.3, opacity: 0.85 }}>{en.meta.shareTagline}</div>
        </div>
      </div>
    ),
    size,
  );
}
