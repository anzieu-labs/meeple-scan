/** Longest side sent to OCR and Gemini: the size the evaluation was run at, ~150–300 KB as JPEG. */
const MAX_SIDE = 1280;

/** Part of a source image, in its own pixels. */
type Region = { x: number; y: number; width: number; height: number };

function toJpeg(source: CanvasImageSource, { x, y, width, height }: Region): Promise<Blob> {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")!.drawImage(source, x, y, width, height, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("JPEG encoding failed"))), "image/jpeg", 0.85),
  );
}

type Rect = Pick<DOMRectReadOnly, "left" | "top" | "right" | "bottom" | "width" | "height">;

/**
 * Maps an on-screen rectangle (`frame`) to the video pixels under it. The video fills its element (`box`)
 * with `object-fit: cover`: scaled up, centred, the overflow cropped.
 */
export function coverRegion(box: Rect, videoWidth: number, videoHeight: number, frame: Rect): Region {
  const scale = Math.max(box.width / videoWidth, box.height / videoHeight);
  const left = box.left + (box.width - videoWidth * scale) / 2;
  const top = box.top + (box.height - videoHeight * scale) / 2;
  const x = Math.max(0, (frame.left - left) / scale);
  const y = Math.max(0, (frame.top - top) / scale);
  return {
    x,
    y,
    width: Math.min(videoWidth, (frame.right - left) / scale) - x,
    height: Math.min(videoHeight, (frame.bottom - top) / scale) - y,
  };
}

/** Grabs what the live camera shows inside `frame` (on-screen coordinates), or the whole frame without one. */
export function captureFrame(video: HTMLVideoElement, frame?: DOMRect): Promise<Blob> {
  const { videoWidth, videoHeight } = video;
  const region = frame
    ? coverRegion(video.getBoundingClientRect(), videoWidth, videoHeight, frame)
    : { x: 0, y: 0, width: videoWidth, height: videoHeight };
  return toJpeg(video, region);
}

/** A photo picked from the gallery, turned upright and shrunk like a camera frame (a phone photo can be 5 MB). */
export async function fromFile(file: Blob): Promise<Blob> {
  const image = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    return await toJpeg(image, { x: 0, y: 0, width: image.width, height: image.height });
  } finally {
    image.close();
  }
}
