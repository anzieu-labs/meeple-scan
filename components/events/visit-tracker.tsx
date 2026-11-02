"use client";

import { useEffect } from "react";

import { track } from "@/lib/events/track";

/** Counts the page load (where the visitor came from) and an install of the app, once per load. */
export function VisitTracker() {
  useEffect(() => {
    // The owner's private stats page is not a visit.
    if (/^(\/[a-zA-Z-]+)?\/stats(\/|$)/.test(location.pathname)) return;
    const params = new URLSearchParams(location.search);
    const referrer = document.referrer ? new URL(document.referrer).host : "";
    track("visit", {
      path: location.pathname,
      ref: params.get("ref") ?? params.get("utm_source") ?? "",
      referrer: referrer === location.host ? "" : referrer,
      device: matchMedia("(min-width: 1024px)").matches ? "computer" : "phone",
      // iOS says so with `navigator.standalone`; other browsers with the display mode.
      installed: matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true,
    });
    const installed = () => track("install");
    addEventListener("appinstalled", installed);
    return () => removeEventListener("appinstalled", installed);
  }, []);
  return null;
}
