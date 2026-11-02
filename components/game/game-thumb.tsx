import { Dices } from "lucide-react";
import Image from "next/image";

import type { GameCard } from "@/lib/game/types";

/** A game's box art; `priority` for the first ones a page shows, loaded straight away (the page's largest paint). */
export function GameThumb({
  game,
  size = 56,
  priority = false,
}: {
  game: Pick<GameCard, "thumbnail" | "name">;
  size?: number;
  priority?: boolean;
}) {
  if (!game.thumbnail) {
    return (
      <div className="flex shrink-0 items-center justify-center rounded-lg bg-muted" style={{ width: size, height: size }}>
        <Dices className="size-6 text-muted-foreground" aria-hidden />
      </div>
    );
  }
  return (
    <Image
      src={game.thumbnail}
      alt=""
      width={size}
      height={size}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      className="shrink-0 rounded-lg bg-muted object-cover"
      style={{ width: size, height: size }}
    />
  );
}
