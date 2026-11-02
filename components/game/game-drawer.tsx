"use client";

import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import type { GameCard } from "@/lib/game/types";
import { useI18n } from "@/lib/i18n/client";

import { GameDetails } from "./game-details";
import { GamePeek } from "./game-peek";
import { PoweredByBgg } from "./powered-by-bgg";

/**
 * One game's card and details in a sheet over the page (history, rankings, search). `game` when the page
 * already has its card; otherwise it's loaded by `bggId`.
 */
export function GameDrawer({
  bggId,
  game,
  onClose,
}: {
  bggId: number | null;
  game?: GameCard | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  // The last game asked for stays in the sheet while it slides away.
  const [last, setLast] = useState({ bggId, game });
  if (bggId !== null && (bggId !== last.bggId || game !== last.game)) setLast({ bggId, game });
  const [loaded, setLoaded] = useState<{ bggId: number; game: GameCard | null } | null>(null);
  const shown = last.game ?? (loaded?.bggId === last.bggId ? loaded.game : null);
  const failed = loaded?.bggId === last.bggId && !loaded.game;

  useEffect(() => {
    const id = last.bggId;
    if (id === null || last.game) return;
    const controller = new AbortController();
    fetch(`/api/games/${id}`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<{ game: GameCard }>) : Promise.reject(new Error(String(res.status)))))
      .then(({ game: card }) => setLoaded({ bggId: id, game: card }))
      .catch(() => controller.signal.aborted || setLoaded({ bggId: id, game: null }));
    return () => controller.abort();
  }, [last]);

  return (
    <Drawer open={bggId !== null} onOpenChange={(open) => !open && onClose()} showSwipeHandle>
      <DrawerContent
        // The whole screen, its top under the phone's status bar.
        className="mx-auto max-w-xl bg-background pt-[env(safe-area-inset-top)] text-foreground [--drawer-content-height:100dvh]! [--drawer-content-max-height:100dvh]!"
        data-testid="game-drawer"
      >
        <DrawerTitle className="sr-only">{t.sheet.title}</DrawerTitle>
        <div className="flex flex-col gap-4 overflow-y-auto overscroll-contain px-4 pt-1 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {shown ? (
            <>
              <GamePeek game={shown} />
              <GameDetails game={shown} />
            </>
          ) : failed ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t.drawer.failed}</p>
          ) : (
            <Skeleton className="h-64 w-full" />
          )}
          <PoweredByBgg />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
