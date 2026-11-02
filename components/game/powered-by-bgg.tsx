"use client";

import Image from "next/image";

import { cn } from "cn";

import { useI18n } from "@/lib/i18n/client";
import logo from "@/public/powered-by-bgg.png";

/**
 * Attribution required by BGG's XML API terms: the official "Powered by BGG" logo, linking to BoardGameGeek,
 * and a line of credit unless `credit` is false (the logo alone is the attribution).
 */
export function PoweredByBgg({ className, credit = true }: { className?: string; credit?: boolean }) {
  const { t } = useI18n();
  return (
    <div className={cn("flex flex-col items-center gap-1 text-center", className)}>
      <a href="https://boardgamegeek.com" target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center rounded-md">
        <Image src={logo} alt={t.bgg.poweredBy} className="h-9 w-auto" />
      </a>
      {credit && <p className="text-xs text-muted-foreground">{t.bgg.credit}</p>}
    </div>
  );
}
