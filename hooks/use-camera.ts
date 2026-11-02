"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/** Camera features browsers expose but TypeScript's DOM lib doesn't type yet. */
interface ExtendedCapabilities extends MediaTrackCapabilities {
  torch?: boolean;
  zoom?: { min: number; max: number; step?: number };
  focusMode?: string[];
}
type ExtendedConstraintSet = MediaTrackConstraintSet & { torch?: boolean; zoom?: number; focusMode?: string };

export type CameraError = "insecure" | "permission" | "no-camera" | "in-use" | "unknown";

export interface CameraState {
  status: "idle" | "starting" | "live" | "error";
  error?: CameraError;
  torch: { supported: boolean; on: boolean };
  zoom: { supported: boolean; min: number; max: number; value: number };
}

const INITIAL: CameraState = {
  status: "idle",
  torch: { supported: false, on: false },
  zoom: { supported: false, min: 1, max: 1, value: 1 },
};

function toCameraError(error: unknown): CameraError {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "permission";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "no-camera";
  if (name === "NotReadableError" || name === "AbortError") return "in-use";
  return "unknown";
}

/**
 * Rear camera stream for photographing boxes. Starts as soon as the page opens (the browser asks for
 * permission the first time), stops while the page is hidden (battery) and resumes when it comes back.
 * Torch and zoom are only offered when the device reports them.
 */
export function useCamera(videoRef: RefObject<HTMLVideoElement | null>) {
  const [state, setState] = useState<CameraState>(INITIAL);
  const streamRef = useRef<MediaStream | null>(null);
  const wantedRef = useRef(false);

  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const open = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState((s) => ({ ...s, status: "error", error: "insecure" }));
      return;
    }
    setState((s) => ({ ...s, status: "starting", error: undefined }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
      });
      if (!wantedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      release();
      streamRef.current = stream;

      const track = stream.getVideoTracks()[0];
      const caps = (track.getCapabilities?.() ?? {}) as ExtendedCapabilities;
      if (caps.focusMode?.includes("continuous")) {
        await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as ExtendedConstraintSet] }).catch(() => {});
      }

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }
      const zoom = caps.zoom;
      setState({
        status: "live",
        torch: { supported: Boolean(caps.torch), on: false },
        zoom: zoom
          ? { supported: zoom.max > zoom.min, min: zoom.min, max: zoom.max, value: zoom.min }
          : INITIAL.zoom,
      });
    } catch (error) {
      setState((s) => ({ ...s, status: "error", error: toCameraError(error) }));
    }
  }, [release, videoRef]);

  const start = useCallback(() => {
    wantedRef.current = true;
    return open();
  }, [open]);

  const stop = useCallback(() => {
    wantedRef.current = false;
    release();
    setState(INITIAL);
  }, [release]);

  const applyAdvanced = useCallback(async (constraint: ExtendedConstraintSet) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return false;
    try {
      await track.applyConstraints({ advanced: [constraint] });
      return true;
    } catch {
      return false;
    }
  }, []);

  // iOS can misreport the torch state after toggling, so the app keeps its own copy.
  const setTorch = useCallback(
    async (on: boolean) => {
      if (await applyAdvanced({ torch: on })) setState((s) => ({ ...s, torch: { ...s.torch, on } }));
    },
    [applyAdvanced],
  );

  const setZoom = useCallback(
    async (value: number) => {
      if (await applyAdvanced({ zoom: value })) setState((s) => ({ ...s, zoom: { ...s.zoom, value } }));
    },
    [applyAdvanced],
  );

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        release();
        // Shown as "starting" so coming back resumes quietly instead of asking to start again.
        setState((s) => (s.status === "live" ? { ...INITIAL, status: "starting" } : s));
      } else if (wantedRef.current) {
        void open();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    wantedRef.current = true;
    void open();
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      wantedRef.current = false;
      release();
    };
  }, [open, release]);

  return { ...state, start, stop, setTorch, setZoom };
}
