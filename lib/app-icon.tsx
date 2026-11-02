import { ImageResponse } from "next/og";

/** The icon's colours: a warm meeple yellow behind the brand's green meeple, framed in dark green. */
export const ICON_COLORS = { background: "#ffc533", meeple: "#00875a", frame: "#103b2c" };

/** A classic meeple in a 100×100 box. */
const MEEPLE =
  "M50 4c11 0 19 8 19 18c0 5-2 9-5 12c11 3 21 6 27 11c4 4 3 10-2 12c-6 2-13 3-19 3c2 9 7 20 12 30c2 5-1 9-6 9H63c-4 0-6-2-8-5l-5-9l-5 9c-2 3-4 5-8 5H24c-5 0-8-4-6-9c5-10 10-21 12-30c-6 0-13-1-19-3c-5-2-6-8-2-12c6-5 16-8 27-11c-3-3-5-7-5-12c0-10 8-18 19-18z";
/** The four corners of a camera frame around it: scanning a game. */
const FRAME = ["M14 30V14H30", "M70 14H86V30", "M86 70V86H70", "M30 86H14V70"];

/** The icon's drawing (frame and meeple, no background), `size` px wide. */
export function IconArt({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {FRAME.map((d) => (
        <path key={d} d={d} fill="none" stroke={ICON_COLORS.frame} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <path d={MEEPLE} fill={ICON_COLORS.meeple} transform="translate(50 47) scale(0.62) translate(-50 -50)" />
    </svg>
  );
}

/**
 * Square app icon: the meeple in its frame on yellow, edge to edge (phones round the corners themselves).
 * `maskable`: shrunk into the middle 80%, the part Android keeps whatever shape it cuts the icon to.
 */
export function appIcon(size: number, { maskable = false } = {}) {
  return new ImageResponse(
    (
      <div
        style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: ICON_COLORS.background }}
      >
        <IconArt size={maskable ? size * 0.8 : size} />
      </div>
    ),
    { width: size, height: size },
  );
}
