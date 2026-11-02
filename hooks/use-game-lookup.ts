"use client";

import { useCallback, useRef, useState } from "react";

import type { CoverEvent, CoverGame, CoverResult, GameCard } from "@/lib/game/types";

/** A game on screen; `picked` when the user chose it ("Wrong game", or search after a box wasn't recognised). */
export interface Shown {
  game: GameCard;
  match: "auto" | "guess" | "picked";
  alternatives: GameCard[];
  /** The user marked it as the right game for the photo. */
  confirmed?: boolean;
}

/**
 * A game found on a photo must be marked right (or replaced) before its details show; one the user picked
 * ("Wrong game", search) is checked already.
 */
export const isChecked = (shown: Shown) => shown.match === "picked" || Boolean(shown.confirmed);

/** How a pick fixes a photo's result; null for a pick that has nothing to do with the photo. */
export type PickedVia = "alternative" | "search" | null;

/**
 * What the sheet shows. `key` changes with every new photo or pick, so per-result UI state resets;
 * `photo` stays the same for everything done with one photo's games. `stack` holds the other games found
 * on the same photo; front then stack is always the photo's order turned around, so going through them
 * stays in a loop. `position` is the front game's place in the photo's order. `logId` is the photo's row in
 * the server's photo log, where what the user confirms or picks instead is recorded. `pending`: other games
 * of the photo are still being looked up, and arrive one by one.
 */
export type LookupState = { key: string } & (
  | { phase: "loading" }
  | { phase: "found"; photo: string; front: Shown; stack: Shown[]; position: number; logId?: string; pending?: boolean }
  | { phase: "not_found"; text: string[]; logId?: string }
  | { phase: "unavailable"; service: "ocr" | "bgg" }
  | { phase: "error" }
);

let counter = 0;
const nextKey = () => `r${++counter}`;

type Found = Extract<LookupState, { phase: "found" }>;

/** The photo's games in the order they were found: the biggest title first. */
export function photoOrder(found: Found) {
  const all = [found.front, ...found.stack];
  const cut = all.length - found.position;
  return [...all.slice(cut), ...all.slice(0, cut)];
}

/** Turns the photo's games `steps` places: 1 shows the next game, -1 the previous one. */
function rotate(found: Found, steps: number): Found {
  const all = [found.front, ...found.stack];
  const k = ((steps % all.length) + all.length) % all.length;
  const [front, ...stack] = [...all.slice(k), ...all.slice(0, k)];
  return { ...found, key: nextKey(), front, stack, position: (found.position + k) % all.length };
}

/** A game that just arrived joins the end of the photo's order; the game in front stays in front. */
function addGame(found: Found, shown: Shown): Found {
  const order = [...photoOrder(found), shown];
  const all = [...order.slice(found.position), ...order.slice(0, found.position)];
  return { ...found, front: all[0], stack: all.slice(1) };
}

/** The events of a streamed `/api/cover` answer, one JSON object per line. */
async function* coverEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<CoverEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = done ? "" : lines.pop()!;
    for (const line of lines) if (line.trim()) yield JSON.parse(line) as CoverEvent;
    if (done) return;
  }
}

/** Sends feedback on a photo to the server's photo log, to tune the matcher later. Best effort. */
function report(logId: string, kind: "corrections" | "confirmations", body: object) {
  void fetch(`/api/photo-logs/${logId}/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {});
}

/** Finds games from photos of boxes (`/api/cover`). A new photo cancels the one in flight. */
export function useGameLookup() {
  const [state, setState] = useState<LookupState | null>(null);
  const pending = useRef<AbortController | null>(null);

  const start = useCallback(() => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const key = nextKey();
    setState({ key, phase: "loading" });
    return { key, controller };
  }, []);

  const fail = useCallback((key: string, controller: AbortController, error: unknown) => {
    if (controller.signal.aborted) return;
    console.error(error);
    setState((current) => (current?.key === key && current.phase === "loading" ? { key, phase: "error" } : current));
  }, []);

  /**
   * Reads the text on a photo and finds every game on it. The games arrive one by one, the main one first;
   * the promise settles with the first answer, while the others keep coming.
   */
  const lookupPhoto = useCallback(
    (photo: Blob) => {
      const { key, controller } = start();
      /** Changes this photo's state, unless another photo or lookup has replaced it since. */
      const update = (change: (current: LookupState) => LookupState) =>
        setState((current) =>
          current && (current.key === key || (current.phase === "found" && current.photo === key)) ? change(current) : current,
        );
      const onGame = (cover: CoverGame, more: boolean, logId: string) =>
        update((current) =>
          current.phase === "found"
            ? { ...addGame(current, cover), pending: more }
            : { key, phase: "found", photo: key, front: cover, stack: [], position: 0, logId, pending: more },
        );
      const onDone = (result: CoverResult) =>
        update((current) => {
          if (current.phase === "found") return { ...current, pending: false };
          if (result.status === "matched") {
            const [front, ...stack] = result.games;
            return { key, phase: "found", photo: key, front, stack, position: 0, logId: result.logId };
          }
          return result.status === "not_found"
            ? { key, phase: "not_found", text: result.text, logId: result.logId }
            : { key, phase: "unavailable", service: result.service };
        });

      return new Promise<void>((answered) => {
        void (async () => {
          try {
            const res = await fetch("/api/cover", {
              method: "POST",
              headers: { "Content-Type": photo.type || "image/jpeg" },
              body: photo,
              signal: controller.signal,
            });
            if (!res.ok || !res.body) throw new Error(`photo lookup failed: ${res.status}`);
            for await (const event of coverEvents(res.body)) {
              if (event.type === "error") throw new Error("photo lookup failed on the server");
              if (event.type === "game") onGame(event.game, event.more, event.logId);
              else onDone(event.result);
              answered();
            }
            // A stream cut short still ends the wait for more games.
            update((current) => (current.phase === "found" && current.pending ? { ...current, pending: false } : current));
          } catch (error) {
            // Games already shown stay; only a photo with nothing to show yet becomes an error.
            if (!controller.signal.aborted) update((current) => (current.phase === "found" ? { ...current, pending: false } : current));
            fail(key, controller, error);
          } finally {
            answered();
          }
        })();
      });
    },
    [start, fail],
  );

  /**
   * The user picked a game (from "Wrong game" or name search). It replaces the front game and keeps
   * the rest of the photo's stack; the previous front stays among the alternatives. A pick that fixes the
   * photo's result (`via`) is reported to the photo log.
   */
  const choose = useCallback(
    (game: GameCard, via: PickedVia) => {
      pending.current?.abort();
      const found = state?.phase === "found" ? state : null;
      const logId = state?.phase === "found" || state?.phase === "not_found" ? state.logId : undefined;
      const from = found ? found.front.game.bggId : null;
      if (logId && via && from !== game.bggId) report(logId, "corrections", { from, to: game.bggId, via });
      const previous = found ? [found.front.game, ...found.front.alternatives] : [];
      const key = nextKey();
      setState({
        key,
        phase: "found",
        photo: found?.photo ?? key,
        pending: found?.pending,
        front: { game, match: "picked", alternatives: previous.filter((g) => g.bggId !== game.bggId) },
        stack: found?.stack ?? [],
        position: found?.position ?? 0,
        logId,
      });
    },
    [state],
  );

  /**
   * The user says games are right for the photo (the front one by default, or those with these BGG ids):
   * their details show, and the photo log learns it.
   */
  const confirm = useCallback(
    (bggIds?: number[]) => {
      if (state?.phase !== "found") return;
      const wanted = bggIds ?? [state.front.game.bggId];
      const mark = (shown: Shown) => {
        if (isChecked(shown) || !wanted.includes(shown.game.bggId)) return shown;
        if (state.logId) report(state.logId, "confirmations", { bggId: shown.game.bggId });
        return { ...shown, confirmed: true };
      };
      setState({ ...state, front: mark(state.front), stack: state.stack.map(mark) });
    },
    [state],
  );

  /** Shows the photo's game at `index` in the photo's order (0 = the biggest title) in front. */
  const showGame = useCallback(
    (index: number) => {
      if (state?.phase !== "found") return;
      const steps = index - state.position;
      if (steps % (state.stack.length + 1)) setState(rotate(state, steps));
    },
    [state],
  );

  /** Shows the next (1) or previous (-1) game from the same photo, looping around. */
  const step = useCallback(
    (direction: 1 | -1) => {
      if (state?.phase === "found" && state.stack.length) setState(rotate(state, direction));
    },
    [state],
  );

  return { state, lookupPhoto, choose, confirm, showGame, step };
}
