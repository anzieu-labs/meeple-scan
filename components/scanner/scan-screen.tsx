"use client";

import { Camera } from "lucide-react";
import { useSyncExternalStore } from "react";

import { useI18n } from "@/lib/i18n/client";

import { Scanner } from "./scanner";

/** Wide screens get the landing page (components/landing) instead of the camera. */
const DESKTOP = "(min-width: 1024px)";

const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/**
 * The camera, on phones and tablets only: a computer gets the landing page, and its camera is never asked
 * for. Until the browser says which (the server can't know), the camera screen's first state stands in.
 */
export function ScanScreen() {
  const phone = useSyncExternalStore(subscribe, () => !window.matchMedia(DESKTOP).matches, () => null);
  if (phone === null) return <StartingCamera />;
  return phone ? <Scanner /> : null;
}

function StartingCamera() {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-black px-8 text-center text-white lg:hidden">
      <Camera className="size-12 text-white/80" aria-hidden />
      <p className="max-w-xs text-sm text-white/80">{t.scanner.starting}</p>
    </div>
  );
}
