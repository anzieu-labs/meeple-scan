/** The result sheet's resting size, shared with the camera screen, which lays its controls out above it. */

/** The sheet's resting height above the tab bar until its top part is measured (a game and its two buttons). */
export const DEFAULT_PEEK_PX = 160;
/** Above the measured top part: the drag handle (12px) and a little room under the content. */
export const PEEK_EXTRA_PX = 20;
/**
 * Where the resting sheet's top is, for laying out the camera controls above it: it runs under the tab bar.
 * `--sheet-peek` is set by the sheet once it has measured what it shows.
 */
export const PEEK = `calc(var(--sheet-peek, ${DEFAULT_PEEK_PX}px) + var(--tab-bar, 88px))`;
