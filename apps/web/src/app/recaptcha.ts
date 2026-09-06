const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

let scriptLoadPromise: Promise<void> | undefined;

function loadScript(): Promise<void> {
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.body.appendChild(script);
  });
  return scriptLoadPromise;
}

/**
 * Bot detection (#57) token for the signup flow, using reCAPTCHA v3's
 * invisible, score-based check rather than a checkbox/puzzle challenge.
 * Returns undefined when this deployment hasn't configured
 * NEXT_PUBLIC_RECAPTCHA_SITE_KEY, or the script fails to load — the
 * server-side check (RecaptchaService) degrades the same way, so signup
 * still works without it.
 */
export async function getRecaptchaToken(action: string): Promise<string | undefined> {
  if (!SITE_KEY || typeof window === "undefined") return undefined;

  await loadScript();
  if (!window.grecaptcha) return undefined;

  try {
    return await new Promise<string>((resolve, reject) => {
      window.grecaptcha!.ready(() => {
        window.grecaptcha!.execute(SITE_KEY, { action }).then(resolve, reject);
      });
    });
  } catch {
    return undefined;
  }
}
