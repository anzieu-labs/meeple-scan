"use client";

import { History, ScanLine, Search, Settings, Trophy, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { cn } from "cn";

import { useI18n } from "@/lib/i18n/client";
import { splitLocale } from "@/lib/i18n/config";
import { setTabBarHeight } from "@/lib/tab-bar";

/** Scan, the app's main action, in the middle. */
const TABS: { path: string; key: "history" | "rankings" | "scan" | "search" | "settings"; icon: LucideIcon; main?: boolean }[] = [
  { path: "/history", key: "history", icon: History },
  { path: "/rankings", key: "rankings", icon: Trophy },
  { path: "/", key: "scan", icon: ScanLine, main: true },
  { path: "/search", key: "search", icon: Search },
  { path: "/settings", key: "settings", icon: Settings },
];

/** Floating pill at the bottom of every page; Scan, the app's main action, is bigger than the others. */
export function TabBar() {
  const { t, href } = useI18n();
  // The page within the language: "/fr/search" is the Search tab.
  const pathname = splitLocale(usePathname()).path;
  const ref = useRef<HTMLElement>(null);

  // Everything above it makes room for the bar and the gap under it (safe area included). Measured on the bar
  // itself: an iPhone home-screen app can report a window height without its status bar.
  useEffect(() => {
    const bar = ref.current;
    if (!bar) return;
    const measure = () => setTabBarHeight(Math.ceil(bar.offsetHeight + parseFloat(getComputedStyle(bar).bottom)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <nav
      ref={ref}
      aria-label={t.tabs.label}
      data-testid="tab-bar"
      className={cn(
        "fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] mx-auto flex max-w-md items-stretch gap-1 rounded-full border border-border/60 bg-background/85 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.25)] backdrop-blur-xl landscape-phone:hidden",
        // Over the scan sheet, which rests behind it; under the game sheets other pages open.
        pathname === "/" ? "z-[52]" : "z-40",
        // On a computer the home page is the landing, with its own links.
        pathname === "/" && "lg:hidden",
      )}
    >
      {TABS.map(({ path, key, icon: Icon, main }) => {
        const active = path === "/" ? pathname === "/" : pathname.startsWith(path);
        return (
          <Link
            key={path}
            href={href(path)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-1.5 text-[0.7rem] font-medium text-foreground/80 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              main && "flex-[1.35] text-xs",
              // A darker green than the score's, for enough contrast on the grey pill.
              active && "bg-muted text-emerald-700",
            )}
          >
            <Icon className={main ? "size-7" : "size-5"} strokeWidth={main ? 2.25 : 2} aria-hidden />
            {t.tabs[key]}
          </Link>
        );
      })}
    </nav>
  );
}
