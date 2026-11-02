"use client";

import { Camera, Flashlight, FlashlightOff, ImageUp, Loader2, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { useCamera } from "@/hooks/use-camera";
import { isChecked, useGameLookup } from "@/hooks/use-game-lookup";
import { captureFrame, fromFile } from "@/lib/camera/photo";
import { track } from "@/lib/events/track";
import { addToHistory } from "@/lib/history";
import { useI18n } from "@/lib/i18n/client";

import { PEEK } from "./sheet-layout";

/**
 * The result sheet (and its animation library) isn't needed to open the camera: it loads when the shutter is
 * pressed, while the photo is being read (a couple of seconds), so it's there for the answer.
 */
const loadGameSheet = () => import("./game-sheet").then((m) => m.GameSheet);
const GameSheet = dynamic(loadGameSheet, { ssr: false });

const CAMERA_BUTTON = "size-11 rounded-full bg-black/50 text-white hover:bg-black/70";

/** Space kept clear between the frame and the sheet, for the shutter (4.5rem) and its margins. */
const SHUTTER_SPACE = "6.5rem";

/**
 * Full-screen camera with a shutter: what's inside the frame is read on the OCR server and the games
 * appear in the Yuka-style sheet below. While a photo is read, it covers the whole screen.
 */
export function Scanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  const camera = useCamera(videoRef);
  const [flash, setFlash] = useState(0);
  /** The photo being read (an object URL), shown full screen until the games are found. */
  const [reading, setReading] = useState<string | null>(null);
  const { state, lookupPhoto, choose, confirm, showGame, step } = useGameLookup();
  const live = camera.status === "live";

  // Every game marked right (or picked) goes to the history on this phone, the front one last so it's on top.
  useEffect(() => {
    if (state?.phase !== "found") return;
    for (const shown of [...[...state.stack].reverse(), state.front]) if (isChecked(shown)) addToHistory(shown.game);
  }, [state]);

  const readPhoto = useCallback(
    async (photo: Blob, source: "camera" | "gallery") => {
      track("photo", { source });
      void loadGameSheet();
      const url = URL.createObjectURL(photo);
      setReading(url);
      try {
        await lookupPhoto(photo);
      } finally {
        setReading(null);
        URL.revokeObjectURL(url);
      }
    },
    [lookupPhoto],
  );

  /** A photo from the gallery, for when the camera can't be used. */
  const readGalleryPhoto = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file) void readPhoto(await fromFile(file), "gallery");
    },
    [readPhoto],
  );

  /**
   * What's inside the frame on the live camera; starts the camera first when it's off. With the camera
   * blocked, "Take another photo" opens the gallery instead.
   */
  const startCamera = camera.start;
  const cameraFailed = camera.status === "error";
  const takePhoto = useCallback(async () => {
    const video = videoRef.current;
    if (cameraFailed) {
      galleryRef.current?.click();
      return;
    }
    if (!live || !video?.videoWidth) {
      startCamera();
      return;
    }
    setFlash((n) => n + 1);
    void readPhoto(await captureFrame(video, frameRef.current?.getBoundingClientRect()), "camera");
  }, [cameraFailed, live, startCamera, readPhoto]);

  const zoomTarget = Math.min(2, camera.zoom.max);
  const zoomedIn = camera.zoom.value > camera.zoom.min;
  // Camera controls sit above the sheet's peek; before the first photo there's no sheet, so above the tab bar.
  const sheetTop = state ? PEEK : "var(--tab-bar, 88px)";

  return (
    <>
      {/* Pinned to the four edges, no height: an iPhone home-screen app can measure 100dvh without its status
          bar, which left a blank strip at the bottom. */}
      <div className="fixed inset-0 overflow-hidden bg-black text-white">
        <div className="absolute inset-0 touch-none overflow-hidden">
          <video
            ref={videoRef}
            className="absolute inset-0 size-full object-cover"
            playsInline
            muted
            autoPlay
            aria-hidden
          />

          {/* Only what's inside the frame is sent: the sheet hides the bottom of the picture. */}
          {live && (
            <div
              ref={frameRef}
              data-testid="photo-frame"
              className="pointer-events-none absolute inset-x-5 top-[max(4.5rem,calc(env(safe-area-inset-top)+4rem))] rounded-2xl border-2 border-white/90 shadow-[0_0_0_100vmax_rgb(0_0_0/0.45)]"
              style={{ bottom: `calc(${sheetTop} + ${SHUTTER_SPACE})` }}
            >
              <p className="absolute inset-x-0 top-3 text-center text-sm font-medium text-white drop-shadow">
                {t.scanner.frameHint}
              </p>
            </div>
          )}

          {flash > 0 && (
            <span key={flash} className="pointer-events-none absolute inset-0 animate-out bg-white fade-out duration-300 fill-mode-forwards motion-reduce:hidden" />
          )}

          {!live && (
            <div
              className="absolute inset-x-0 top-0 flex flex-col items-center justify-center gap-4 bg-black/80 px-8 text-center"
              style={{ bottom: sheetTop }}
            >
              <Camera className="size-12 text-white/80" aria-hidden />
              {camera.status === "error" && camera.error ? (
                <>
                  <p className="max-w-xs text-sm text-white/80" role="alert">
                    {t.scanner.cameraErrors[camera.error]}
                  </p>
                  <Button size="lg" onClick={() => galleryRef.current?.click()} className="h-11 bg-white px-6 text-black hover:bg-white/90">
                    <ImageUp aria-hidden /> {t.scanner.fromGallery}
                  </Button>
                  <Button size="lg" variant="ghost" onClick={camera.start} className="h-11 px-6 text-white hover:bg-white/10 hover:text-white">
                    {t.scanner.tryAgain}
                  </Button>
                </>
              ) : (
                <p className="flex max-w-xs flex-col items-center gap-2 text-sm text-white/80" role="status">
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                  {t.scanner.starting}
                </p>
              )}
            </div>
          )}

          {live && (
            <div className="absolute inset-x-0 flex justify-center" style={{ bottom: `calc(${sheetTop} + 1rem)` }}>
              <button
                type="button"
                onClick={takePhoto}
                aria-label={t.scanner.takePhoto}
                className="flex size-18 items-center justify-center rounded-full border-4 border-white/90 bg-white/20 shadow-lg backdrop-blur-sm transition active:scale-95"
              >
                <span className="size-14 rounded-full bg-white" />
              </button>
            </div>
          )}

          {/* After the start overlay so the camera controls stay on top of it. */}
          <div className="absolute inset-x-0 top-0 flex justify-end gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            {camera.zoom.supported && zoomTarget > camera.zoom.min && (
              <Button
                variant="secondary"
                size="icon-lg"
                className={CAMERA_BUTTON}
                onClick={() => camera.setZoom(zoomedIn ? camera.zoom.min : zoomTarget)}
                aria-label={zoomedIn ? t.scanner.zoomOut : t.scanner.zoomIn}
              >
                {zoomedIn ? "1×" : `${zoomTarget}×`}
              </Button>
            )}
            {camera.torch.supported && (
              <Button
                variant="secondary"
                size="icon-lg"
                className={CAMERA_BUTTON}
                onClick={() => camera.setTorch(!camera.torch.on)}
                aria-label={camera.torch.on ? t.scanner.torchOff : t.scanner.torchOn}
                aria-pressed={camera.torch.on}
              >
                {camera.torch.on ? <FlashlightOff /> : <Flashlight />}
              </Button>
            )}
          </div>
        </div>

        {/* No `capture`: the phone opens its photo library, not the camera that was refused. */}
        <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={readGalleryPhoto} data-testid="gallery-input" />

        {state && (
          <GameSheet
            state={state}
            onPhoto={takePhoto}
            onChoose={choose}
            onShowGame={showGame}
            onStep={step}
            onConfirm={confirm}
          />
        )}
      </div>

      {/* Outside the camera view: its fixed position makes a stacking context the sheet would sit above. */}
      {reading && (
        <div
          className="fixed inset-0 z-[55] flex flex-col items-center justify-center gap-6 bg-black/90 px-6 text-center text-white backdrop-blur-sm"
          role="status"
          data-testid="reading-photo"
        >
          <div className="relative overflow-hidden rounded-2xl border-2 border-white/90">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, nothing to optimise */}
            <img src={reading} alt="" className="block max-h-[55dvh] max-w-full object-contain" />
            <span className="absolute inset-x-0 h-0.5 animate-scan bg-white shadow-[0_0_12px_2px_rgb(255_255_255/0.8)] motion-reduce:hidden" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="flex items-center gap-2 text-base font-medium">
              <Loader2 className="size-5 animate-spin" aria-hidden /> {t.scanner.reading}
            </p>
            <p className="text-sm text-white/70">{t.scanner.readingHint}</p>
          </div>
        </div>
      )}

      <div
        className="fixed inset-0 z-[60] hidden flex-col items-center justify-center gap-3 bg-black text-center text-white landscape-phone:flex"
        role="status"
      >
        <RotateCcw className="size-10 text-white/70" aria-hidden />
        <p className="text-base font-medium">{t.scanner.upright}</p>
      </div>
    </>
  );
}
