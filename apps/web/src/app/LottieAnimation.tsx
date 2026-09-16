"use client";

import { useEffect, useRef } from "react";

/**
 * Tinder's real "Support for high-quality Lottie animations in the UI"
 * (#280): a thin, reusable wrapper around the real `lottie-web` renderer
 * (Airbnb's own vector-animation player, the same one Tinder's own app
 * uses for its match/like celebration effects), not a CSS/GIF stand-in.
 * `src` points at a real Lottie JSON file under `public/lottie/` — see
 * `match-celebration.json` for the first one wired up (the match notice
 * in discover/page.tsx). `lottie-web` touches the DOM directly, so it's
 * loaded dynamically on the client only, never during SSR.
 */
export default function LottieAnimation({
  src,
  loop = false,
  width = 120,
  height = 120,
}: {
  src: string;
  loop?: boolean;
  width?: number;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animation: { destroy: () => void } | undefined;
    let cancelled = false;

    import("lottie-web").then(({ default: lottie }) => {
      if (cancelled || !containerRef.current) return;
      animation = lottie.loadAnimation({
        container: containerRef.current,
        renderer: "svg",
        loop,
        autoplay: true,
        path: src,
      });
    });

    return () => {
      cancelled = true;
      animation?.destroy();
    };
  }, [src, loop]);

  return <div ref={containerRef} style={{ width, height, margin: "0 auto" }} aria-hidden="true" />;
}
