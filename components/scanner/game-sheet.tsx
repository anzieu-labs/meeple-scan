"use client";

import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  CloudOff,
  Loader2,
  ScanText,
  SearchX,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, MotionConfig, animate, motion, useMotionValue } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import Image from "next/image";
import { flushSync } from "react-dom";

import { cn } from "cn";

import { GameChoiceList } from "@/components/game/game-choice-list";
import { GameDetails } from "@/components/game/game-details";
import { GamePeek } from "@/components/game/game-peek";
import { GameSearch } from "@/components/game/game-search";
import { GameThumb } from "@/components/game/game-thumb";
import { PoweredByBgg } from "@/components/game/powered-by-bgg";
import { TIER_DOT } from "@/components/game/score-badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { isChecked, photoOrder, type LookupState, type PickedVia, type Shown } from "@/hooks/use-game-lookup";
import { ratingTier } from "@/lib/game/labels";
import { useI18n } from "@/lib/i18n/client";
import { fill, formatRating, plural } from "@/lib/i18n/format";
import { tabBarStore } from "@/lib/tab-bar";

import { DEFAULT_PEEK_PX, PEEK_EXTRA_PX } from "./sheet-layout";
import type { GameCard } from "@/lib/game/types";

/** Pulled up, the sheet takes the whole screen. */
const FULL = 1;

/** How far a finger must travel sideways to switch games. */
const SWIPE_DISTANCE = 56;
/**
 * How far a finger travels before its swipe is locked to one axis, and how much more sideways than vertical
 * it must be to count as sideways: the drawer's own rule, so the drawer and the pager never both take it.
 */
const AXIS_SLOP = 6;
const AXIS_BIAS = 2;

/** New content slides in from the side of `direction` (1 next, -1 previous); 0 swaps it at once. */
const SLIDE = {
  enter: (direction: number) => (direction ? { opacity: 0, x: 32 * direction } : { opacity: 1, x: 0 }),
  center: { opacity: 1, x: 0 },
  leave: (direction: number) =>
    direction ? { opacity: 0, x: -32 * direction } : { opacity: 0, transition: { duration: 0 } },
};

/**
 * Yuka-style bottom sheet, there once a photo is taken: peeking with the current game (or what to do
 * next), and pulled up for details. Non-modal so the camera stays live behind it. A photo of several boxes
 * opens on a summary of its games, each marked right or wrong from the list; tapping one shows it.
 */
export function GameSheet({
  state,
  onPhoto,
  onChoose,
  onShowGame,
  onStep,
  onConfirm,
}: {
  state: LookupState;
  /** Takes a photo of the box (live camera, or the phone's own camera when it's off). */
  onPhoto: () => void;
  /** The user picked a game; `via` when it fixes the photo's result ("Wrong game", search for the box). */
  onChoose: (game: GameCard, via: PickedVia) => void;
  /** Shows the photo's game at this index in the photo's order. */
  onShowGame: (index: number) => void;
  /** Shows the next (1) or previous (-1) game from the same photo. */
  onStep: (direction: 1 | -1) => void;
  /** The user says games are right for the photo: the front one, or those with these BGG ids. */
  onConfirm: (bggIds?: number[]) => void;
}) {
  const { t } = useI18n();
  const [snap, setSnap] = useState<"peek" | "full">("peek");
  // Resting, the sheet's bottom is behind the floating tab bar.
  const tabBar = useSyncExternalStore(tabBarStore.subscribe, tabBarStore.getSnapshot, tabBarStore.getServerSnapshot);
  // Resting, only the top part shows (the game and its buttons, or the photo's summary): the sheet is as tall
  // as that, so no blank space is left above the tab bar.
  // A state, not a ref: the sheet's content mounts in a portal after this component, so it's measured once
  // it's there.
  const [head, setHead] = useState<HTMLDivElement | null>(null);
  const [peekPx, setPeekPx] = useState(DEFAULT_PEEK_PX);
  useEffect(() => {
    if (!head) return;
    const measure = () => setPeekPx(Math.ceil(head.offsetHeight) + PEEK_EXTRA_PX);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(head);
    return () => observer.disconnect();
  }, [head]);
  useEffect(() => {
    document.documentElement.style.setProperty("--sheet-peek", `${peekPx}px`);
  }, [peekPx]);
  const peekPoint = `${peekPx + (tabBar || tabBarStore.getServerSnapshot())}px`;
  const collapseUntil = useRef(0);
  const expanded = snap === "full";
  const found = state.phase === "found" ? state : null;
  const stack = found?.stack ?? [];
  /** The front game, as "photo:bggId": what "Wrong game" is correcting, until a game is picked. */
  const frontId = found ? `${found.photo}:${found.front.game.bggId}` : null;
  /** A game from the photo that the user hasn't said is right yet: its details wait for the answer. */
  const unchecked = found !== null && !isChecked(found.front);
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const correcting = unchecked && correctingId === frontId;
  /** The photo whose games are shown one at a time; any other photo of several games shows its summary. */
  const [gameViewFor, setGameViewFor] = useState<string | null>(null);
  /** Several games, or more still coming: the summary. */
  const multi = stack.length > 0 || Boolean(found?.pending);
  const summary = multi && gameViewFor !== found?.photo;
  /** "Wrong game" was tapped in the summary: once the right game is picked, the summary comes back. */
  const backToSummary = useRef(false);

  // A photo's games open pulled up: the game and its question, or the summary of several.
  const [photo, setPhoto] = useState<string | null>(null);
  if (found && found.photo !== photo) {
    setPhoto(found.photo);
    setGameViewFor(null);
    setSnap("full");
  }

  /** Opens the alternatives and search; the game picked there is logged as the photo's correction. */
  const startCorrecting = () => {
    setCorrectingId(frontId);
    setSnap("full");
  };
  const stopCorrecting = () => {
    setCorrectingId(null);
    if (backToSummary.current) setGameViewFor(null);
    backToSummary.current = false;
  };
  const choose = (game: GameCard, via: PickedVia) => {
    onChoose(game, via);
    if (backToSummary.current) setGameViewFor(null);
    backToSummary.current = false;
  };
  /** Shows one game of the photo; `wrong` opens its correction straight away. */
  const openGame = (index: number, wrong = false) => {
    if (!found) return;
    onShowGame(index);
    setGameViewFor(found.photo);
    setSnap("full");
    backToSummary.current = wrong;
    setCorrectingId(wrong ? `${found.photo}:${photoOrder(found)[index].game.bggId}` : null);
  };
  // Pulled up on one game, the games from the same photo are a row: swipe left for the next one, right for the previous.
  const pageable = expanded && !correcting && multi && !summary;
  /**
   * Which way the last change went, so a new game slides in from that side; 0 while the sheet's content is
   * being swapped, so it doesn't slide a second time.
   */
  const [direction, setDirection] = useState<1 | 0 | -1>(1);
  const popupRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  /** A swipe just ended: the click it ends with must not toggle the sheet. */
  const swiped = useRef(false);
  /** How far the sheet's content is pushed sideways; the sheet itself stays in place. */
  const contentX = useMotionValue(0);
  /** Sends the content off to one side and brings the next (1) or previous (-1) game's in from the other. */
  const swapContent = async (to: 1 | -1) => {
    const width = contentRef.current?.offsetWidth ?? window.innerWidth;
    await animate(contentX, -to * width, { duration: 0.16, ease: "easeIn" });
    flushSync(() => {
      setDirection(0);
      onStep(to);
    });
    bodyRef.current?.scrollTo({ top: 0 });
    // jump(), not set(): a set() from one side to the other reads as a huge speed and the spring overshoots.
    contentX.jump(to * width);
    await animate(contentX, 0, { type: "spring", stiffness: 380, damping: 36 });
    setDirection(1);
  };

  const startSwipe = (e: ReactPointerEvent) => {
    if (!pageable) return;
    const from = { x: e.clientX, y: e.clientY };
    let sideways: boolean | null = null;
    swiped.current = false;
    // On the window: the drawer captures the pointer while dragging, so the sheet may not see it move or lift.
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - from.x;
      const dy = ev.clientY - from.y;
      if (sideways === null) {
        // A drag the drawer already took (by its handle) stays vertical.
        if (popupRef.current?.hasAttribute("data-swiping")) sideways = false;
        else if (Math.abs(dx) >= AXIS_SLOP && Math.abs(dx) > Math.abs(dy) + AXIS_BIAS) sideways = true;
        else if (Math.abs(dy) >= AXIS_SLOP) sideways = false;
      }
      if (sideways) {
        swiped.current = true;
        contentX.set(dx);
      }
    };
    // Sideways, the finger drifting up or down must not scroll the details either.
    const touchMove = (ev: TouchEvent) => {
      if (sideways && ev.cancelable) ev.preventDefault();
    };
    const end = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("touchmove", touchMove);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (!sideways) return;
      const dx = ev.clientX - from.x;
      if (ev.type === "pointerup" && Math.abs(dx) >= SWIPE_DISTANCE) void swapContent(dx < 0 ? 1 : -1);
      else void animate(contentX, 0, { type: "spring", stiffness: 420, damping: 38 });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("touchmove", touchMove, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  /**
   * Resting at the peek, a tap anywhere on the sheet opens it in full. The peek's own buttons (the game, "Right
   * game", "Wrong game") already do; a tap anywhere else used to reach the hidden details under the peek.
   */
  const snappedAt = useRef(0);
  const openOnTap = (event: ReactMouseEvent) => {
    if (expanded || (event.target as Element).closest("button, a")) return;
    // The click a drag down to the peek ends with is not a tap.
    if (performance.now() - snappedAt.current < 400) return;
    event.preventDefault();
    event.stopPropagation();
    setSnap("full");
  };

  return (
    <MotionConfig reducedMotion="user">
      <Drawer
        open
        modal={false}
        disablePointerDismissal
        showSwipeHandle
        snapPoints={[peekPoint, FULL]}
        snapPoint={expanded ? FULL : peekPoint}
        onSnapPointChange={(next) => {
          const to = next === FULL ? "full" : "peek";
          // A plain tap reports the snap point it's already at: only a real move counts as a drag.
          if (to !== snap) snappedAt.current = performance.now();
          // After a fling-to-close the drawer restores its previous snap point; keep the peek instead.
          if (performance.now() < collapseUntil.current && to !== "peek") return;
          setSnap(to);
        }}
        // Swiping below the peek asks to close: the sheet never closes, it settles at the peek.
        onOpenChange={() => {
          snappedAt.current = performance.now();
          collapseUntil.current = performance.now() + 600;
          setSnap("peek");
        }}
      >
        <DrawerContent
          className={cn(
            "mx-auto max-w-xl bg-background pb-[max(0px,calc(var(--drawer-snap-point-offset)+var(--drawer-swipe-movement-y)))] text-foreground [--drawer-content-max-height:100dvh]!",
            // Full height, its top is under the phone's status bar.
            expanded && "pt-[env(safe-area-inset-top)]",
          )}
          onPointerDown={startSwipe}
          onClickCapture={openOnTap}
          // Pageable, the drawer waits to see which way a touch goes and leaves sideways ones to startSwipe.
          data-base-ui-swipe-ignore={pageable ? "x" : undefined}
          ref={popupRef}
        >
          <DrawerTitle className="sr-only">{t.sheet.title}</DrawerTitle>
          {/* Only on the open sheet, not in the peek. */}
          {found && multi && !summary && expanded && (
            <Button
              size="sm"
              variant="ghost"
              className="absolute top-[calc(env(safe-area-inset-top)+0.375rem)] left-2 z-10 text-muted-foreground"
              onClick={() => {
                backToSummary.current = false;
                setCorrectingId(null);
                setGameViewFor(null);
              }}
            >
              <ArrowLeft aria-hidden /> {t.sheet.allGames}
            </Button>
          )}
          {pageable && found && <PhotoPager position={found.position} total={stack.length + 1} />}
          {/* Everything else in the sheet slides sideways between games; the sheet, its handle and the dots stay put. */}
          <motion.div
            className="flex min-h-0 flex-1 flex-col"
            style={{ x: contentX }}
            data-testid="sheet-content"
            ref={contentRef}
          >
            <div ref={setHead} className="flex shrink-0 flex-col">
            <button
              type="button"
              onClick={() => {
                if (swiped.current) swiped.current = false;
                else setSnap(expanded ? "peek" : "full");
              }}
              aria-expanded={expanded}
              aria-label={expanded ? t.sheet.showLess : t.sheet.showDetails}
              className={cn(
                "shrink-0 overflow-hidden px-4 pt-1 pb-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
                pageable && "touch-pan-y",
              )}
            >
              <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                  <motion.div
                    key={summary ? `${found?.photo}:summary` : `${state.key}:${state.phase}`}
                    custom={direction}
                    variants={SLIDE}
                    initial="enter"
                    animate="center"
                    exit="leave"
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    aria-live="polite"
                  >
                    {summary && found ? (
                      <SummaryPeek games={photoOrder(found)} pending={Boolean(found.pending)} />
                    ) : (
                      <Peek state={state} locked={unchecked} />
                    )}
                  </motion.div>
                </AnimatePresence>
            </button>
            {unchecked && !correcting && !summary && (
              <CheckGame
                onWrong={startCorrecting}
                onRight={() => {
                  onConfirm();
                  setSnap("full");
                }}
              />
            )}
            </div>

            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(var(--tab-bar,88px)+1rem)] transition-opacity duration-200",
                // Resting, only the peek shows: the rest would peep out under the tab bar. Dragged up, it follows.
                !expanded && "pointer-events-none opacity-0 group-data-swiping/drawer-popup:opacity-100",
                // Horizontal moves stay with the page (no browser panning) so they can be read as swipes.
                pageable ? "touch-pan-y" : "touch-auto",
              )}
              data-testid="sheet-body"
              ref={bodyRef}
            >
                <motion.div
                  key={summary ? `${found?.photo}:summary` : state.key}
                  custom={direction}
                  variants={SLIDE}
                  initial={pageable ? "enter" : false}
                  animate="center"
                >
                  {summary && found ? (
                    <PhotoSummary
                      games={photoOrder(found)}
                      pending={Boolean(found.pending)}
                      onOpen={(index) => openGame(index)}
                      onWrong={(index) => openGame(index, true)}
                      onConfirm={onConfirm}
                    />
                  ) : (
                    <Body
                      state={state}
                      correcting={correcting}
                      onPhoto={onPhoto}
                      onChoose={choose}
                      onStopCorrecting={stopCorrecting}
                    />
                  )}
                </motion.div>
              <PoweredByBgg className="mt-6" />
            </div>
          </motion.div>
        </DrawerContent>
      </Drawer>
    </MotionConfig>
  );
}

/**
 * "● ○ ○" at the top of the sheet: where this game sits among the games on the photo. It stays in place
 * while the content slides between them.
 */
function PhotoPager({ position, total }: { position: number; total: number }) {
  const { t } = useI18n();
  return (
    <div data-testid="photo-pager" className="flex shrink-0 justify-center gap-1.5 pt-1 pb-2">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            "h-1.5 rounded-full transition-all duration-200",
            i === position ? "w-3 bg-foreground" : "w-1.5 bg-muted-foreground/40",
          )}
        />
      ))}
      <span className="sr-only">
        {fill(t.sheet.pager, { position: position + 1, total })}
      </span>
    </div>
  );
}
/** The resting sheet for a photo of several boxes: their art, overlapping, and how many there are. */
function SummaryPeek({ games, pending }: { games: Shown[]; pending: boolean }) {
  const { locale, t } = useI18n();
  return (
    <div className="flex min-h-16 items-center gap-3" data-testid="summary-peek">
      <div className="flex shrink-0 -space-x-6">
        {games.slice(0, 3).map(({ game }) => (
          <span key={game.bggId} className="rounded-lg ring-2 ring-background">
            <GameThumb game={game} size={56} />
          </span>
        ))}
      </div>
      <div className="min-w-0">
        <h2 className="font-heading text-base font-semibold">
          {plural(locale, games.length, t.summary.games)}
        </h2>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          {pending ? t.summary.lookingForMore : t.summary.tellUs}
        </p>
      </div>
    </div>
  );
}

/**
 * Every game found on a photo of several boxes, biggest title first: each one is marked right or wrong
 * from its row, or all at once. A game marked right shows its score; tapping a game shows its details.
 */
function PhotoSummary({
  games,
  pending,
  onOpen,
  onWrong,
  onConfirm,
}: {
  games: Shown[];
  /** More games are on their way: a placeholder row stands in for the next one. */
  pending: boolean;
  onOpen: (index: number) => void;
  onWrong: (index: number) => void;
  onConfirm: (bggIds: number[]) => void;
}) {
  const { locale, t } = useI18n();
  const unchecked = games.filter((shown) => !isChecked(shown)).map((shown) => shown.game.bggId);
  return (
    <div className="flex flex-col gap-4" data-testid="photo-summary">
      <ul className="divide-y">
        {games.map((shown, index) => {
          const { game } = shown;
          const checked = isChecked(shown);
          const tier = ratingTier(game);
          return (
            <li key={game.bggId} className="flex items-center gap-2 py-2" data-testid="summary-game">
              <button
                type="button"
                onClick={() => onOpen(index)}
                className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <GameThumb game={game} size={48} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{game.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[game.yearPublished, game.type === "boardgameexpansion" && t.game.expansion, !checked && shown.match === "guess" && t.game.bestGuess]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                {checked && (
                  <span className="flex items-center gap-1.5 text-sm font-semibold tabular-nums">
                    {tier === "none" ? "–" : formatRating(locale, game.ratingAverage!)}
                    <span className={`size-2.5 rounded-full ${TIER_DOT[tier]}`} aria-hidden />
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </span>
                )}
              </button>
              {!checked && (
                <>
                  <Button
                    variant="outline"
                    size="icon-lg"
                    className="size-11 rounded-full border-2 border-score-poor/40 text-score-poor hover:bg-score-poor/10 hover:text-score-poor"
                    aria-label={fill(t.summary.wrongGame, { name: game.name })}
                    onClick={() => onWrong(index)}
                  >
                    <X />
                  </Button>
                  <Button
                    size="icon-lg"
                    className="size-11 rounded-full bg-score-excellent text-white hover:bg-score-excellent/90"
                    aria-label={fill(t.summary.rightGame, { name: game.name })}
                    onClick={() => onConfirm([game.bggId])}
                  >
                    <Check />
                  </Button>
                </>
              )}
            </li>
          );
        })}
        {pending && (
          <li className="flex items-center gap-3 py-2" data-testid="summary-loading" aria-label={t.summary.lookingForMore}>
            <Skeleton className="size-12 rounded-lg" />
            <span className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-1/5" />
            </span>
          </li>
        )}
      </ul>
      {unchecked.length > 1 && (
        <Button
          className="h-12 rounded-xl bg-score-excellent text-base font-semibold text-white hover:bg-score-excellent/90"
          onClick={() => onConfirm(unchecked)}
        >
          <Check aria-hidden /> {t.summary.allRight}
        </Button>
      )}
    </div>
  );
}

function PeekMessage({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint: string }) {
  return (
    <div className="flex min-h-16 items-center gap-3">
      <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-7 text-muted-foreground" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="font-heading text-base font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

function Peek({ state, locked }: { state: LookupState; locked: boolean }) {
  const { t } = useI18n();
  switch (state.phase) {
    case "loading":
      return <PeekMessage icon={ScanText} {...t.sheet.loading} />;
    case "found":
      // "Best guess" is the question the buttons ask; once answered, it no longer applies.
      return <GamePeek game={state.front.game} guess={locked && state.front.match === "guess"} locked={locked} />;
    case "not_found":
      return <PeekMessage icon={SearchX} {...t.sheet.notFound} />;
    case "unavailable":
      return state.service === "bgg" ? (
        <PeekMessage icon={CloudOff} {...t.sheet.bggBusy} />
      ) : (
        <PeekMessage icon={CloudOff} {...t.sheet.readerDown} />
      );
    case "error":
      return <PeekMessage icon={TriangleAlert} {...t.sheet.error} />;
  }
}

/**
 * Right or wrong: asked under every game found on a photo, before anything else about it shows. Big and
 * coloured, so it's answered rather than skipped.
 */
function CheckGame({ onRight, onWrong }: { onRight: () => void; onWrong: () => void }) {
  const { t } = useI18n();
  return (
    <div className="grid shrink-0 grid-cols-2 gap-2 px-4 pb-3" role="group" aria-label={t.sheet.check} data-testid="check-game">
      <Button
        variant="outline"
        className="h-12 rounded-xl border-2 border-score-poor/40 text-base font-semibold text-score-poor hover:bg-score-poor/10 hover:text-score-poor"
        onClick={onWrong}
      >
        <X aria-hidden /> {t.sheet.wrongGame}
      </Button>
      <Button
        className="h-12 rounded-xl bg-score-excellent text-base font-semibold text-white hover:bg-score-excellent/90"
        onClick={onRight}
      >
        <Check aria-hidden /> {t.sheet.rightGame}
      </Button>
    </div>
  );
}

function PhotoButton({ onPhoto, children }: { onPhoto: () => void; children: ReactNode }) {
  return (
    <Button variant="secondary" className="h-11 self-start" onClick={onPhoto}>
      <Camera aria-hidden /> {children}
    </Button>
  );
}

function Body({
  state,
  correcting,
  onPhoto,
  onChoose,
  onStopCorrecting,
}: {
  state: LookupState;
  correcting: boolean;
  onPhoto: () => void;
  onChoose: (game: GameCard, via: PickedVia) => void;
  onStopCorrecting: () => void;
}): ReactNode {
  const { t } = useI18n();
  switch (state.phase) {
    case "loading":
      return (
        <p className="text-sm text-muted-foreground">{t.sheet.loadingText}</p>
      );
    case "not_found":
      return (
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            {t.sheet.notFoundText}
          </p>
          {state.text.length > 0 && (
            <p className="text-xs text-muted-foreground">{fill(t.sheet.readOnBox, { text: state.text.join(" · ") })}</p>
          )}
          <PhotoButton onPhoto={onPhoto}>{t.sheet.takeAnother}</PhotoButton>
          <GameSearch onPick={(game) => onChoose(game, "search")} />
        </div>
      );
    case "unavailable":
    case "error":
      return (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            {state.phase === "error"
              ? t.sheet.errorText
              : state.service === "bgg"
                ? t.sheet.bggBusyText
                : t.sheet.readerDownText}
          </p>
          <PhotoButton onPhoto={onPhoto}>{t.sheet.tryAgain}</PhotoButton>
          <GameSearch onPick={(game) => onChoose(game, "search")} />
        </div>
      );
  }

  if (state.phase !== "found") return null;
  const { front } = state;
  if (correcting) {
    return (
      <div className="flex flex-col gap-3" data-testid="correct-game">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold">{t.sheet.whichGame}</h3>
          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={onStopCorrecting}>
            <ArrowLeft aria-hidden /> {t.sheet.back}
          </Button>
        </div>
        {front.alternatives.length > 0 && (
          <GameChoiceList games={front.alternatives} onPick={(game) => onChoose(game, "alternative")} />
        )}
        <div>
          <p className="mb-2 text-xs text-muted-foreground">
            {front.alternatives.length ? t.sheet.notInList : t.sheet.searchByName}
          </p>
          <GameSearch
            initialQuery={front.alternatives.length ? "" : front.game.name}
            onPick={(game) => onChoose(game, "search")}
          />
        </div>
      </div>
    );
  }
  if (!isChecked(front)) {
    return (
      <div className="flex flex-col items-center gap-4 py-2" data-testid="confirm-first">
        {/* The big box art is the easiest way to tell: compare it with the box in your hands. */}
        {front.game.image && (
          <Image
            src={front.game.image}
            alt={fill(t.sheet.boxOf, { name: front.game.name })}
            width={480}
            height={480}
            sizes="(max-width: 36rem) 100vw, 36rem"
            className="max-h-72 w-auto rounded-xl object-contain shadow-md"
          />
        )}
        <p className="text-center text-sm text-muted-foreground">
          {t.sheet.confirmFirst}
        </p>
      </div>
    );
  }
  return <GameDetails game={front.game} />;
}
