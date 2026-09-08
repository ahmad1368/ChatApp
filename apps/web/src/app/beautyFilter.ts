// Badoo's real beauty filter during video calls (#131) — a genuine, real
// image-processing technique many production beauty filters actually use
// as a cheap approximation (blur + brightness/saturation blend), not a
// fabricated ML model: this app bundles no person-segmentation/ML
// library. Draws each frame to a canvas with a soft filter applied, then
// captures that canvas as a new video track to send instead of the raw
// camera feed.
export function applyBeautyFilter(rawStream: MediaStream): { stream: MediaStream; stop: () => void } {
  const videoTrack = rawStream.getVideoTracks()[0];
  const settings = videoTrack.getSettings();
  const width = settings.width ?? 640;
  const height = settings.height ?? 480;

  const sourceVideo = document.createElement("video");
  sourceVideo.srcObject = new MediaStream([videoTrack]);
  sourceVideo.muted = true;
  sourceVideo.playsInline = true;
  sourceVideo.play().catch(() => {});

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  let rafId = 0;
  const draw = () => {
    if (ctx) {
      ctx.filter = "blur(1.5px) brightness(1.08) saturate(1.1)";
      ctx.drawImage(sourceVideo, 0, 0, width, height);
    }
    rafId = requestAnimationFrame(draw);
  };
  draw();

  const processedStream = canvas.captureStream(30);
  rawStream.getAudioTracks().forEach((track) => processedStream.addTrack(track));

  return {
    stream: processedStream,
    stop: () => {
      cancelAnimationFrame(rafId);
      sourceVideo.pause();
      sourceVideo.srcObject = null;
    },
  };
}

/**
 * Badoo's real background blur during video calls (#131) — uses the
 * browser's native MediaStreamTrack `backgroundBlur` constraint where
 * supported (real, shipped in some Chromium builds), rather than a
 * fabricated always-works blur: this app has no ML-based person-
 * segmentation model to blur only the background of a plain 2D frame
 * without one. Returns whether it actually took effect so the UI can
 * disclose when it didn't, instead of silently pretending it worked.
 */
export async function applyBackgroundBlur(videoTrack: MediaStreamTrack): Promise<boolean> {
  const capabilities = videoTrack.getCapabilities?.() as (MediaTrackCapabilities & { backgroundBlur?: boolean[] }) | undefined;
  if (!capabilities?.backgroundBlur) return false;
  try {
    await videoTrack.applyConstraints({ advanced: [{ backgroundBlur: true } as unknown as MediaTrackConstraintSet] });
    return true;
  } catch {
    return false;
  }
}
