"use client";

import dynamic from "next/dynamic";
import { useState, type ComponentProps } from "react";

const GameDrawer = dynamic(() => import("./game-drawer").then((m) => m.GameDrawer), { ssr: false });

/** The game sheet, whose code (the drawer and its gestures) loads with the first game opened, not with the page. */
export function LazyGameDrawer(props: ComponentProps<typeof GameDrawer>) {
  const [used, setUsed] = useState(false);
  if (props.bggId !== null && !used) setUsed(true);
  return used ? <GameDrawer {...props} /> : null;
}
