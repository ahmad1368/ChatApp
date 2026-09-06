// Lazy-loaded: the MediaPipe WASM runtime + model (~a few hundred KB) only
// need to be fetched when someone actually reaches the avatar step, not as
// part of the app's initial bundle.
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
const WASM_BASE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MIN_CONFIDENCE = 0.5;

let detectorPromise: Promise<import("@mediapipe/tasks-vision").FaceDetector> | null = null;

async function getDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
      return FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: "IMAGE",
      });
    })();
  }
  return detectorPromise;
}

/** Runs on-device face detection — the image never leaves the browser for
 * this check. Returns true if at least one face was found with reasonable
 * confidence. Never throws: a model-load failure (offline, blocked CDN)
 * degrades to "can't tell", which callers should treat as non-blocking. */
export async function detectFace(image: HTMLImageElement): Promise<boolean | undefined> {
  try {
    const detector = await getDetector();
    const result = detector.detect(image);
    return result.detections.some((d) => (d.categories[0]?.score ?? 0) >= MIN_CONFIDENCE);
  } catch (err) {
    console.error("Face detection unavailable:", err);
    return undefined;
  }
}
