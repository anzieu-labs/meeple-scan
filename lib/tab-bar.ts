/**
 * Height of the floating tab bar plus the gap under it, measured by the bar itself: the scan sheet's
 * resting height and the pages' bottom padding make room for it. Also set as the `--tab-bar` CSS variable.
 */
let height = 0;
const listeners = new Set<() => void>();

export const tabBarStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => height,
  /** Before the bar is measured: its usual height on a phone. */
  getServerSnapshot: () => 88,
};

export function setTabBarHeight(next: number) {
  if (next === height) return;
  height = next;
  document.documentElement.style.setProperty("--tab-bar", `${next}px`);
  listeners.forEach((listener) => listener());
}
