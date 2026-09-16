export const AI_AVATAR_STYLES = ["anime", "3d-cartoon", "oil-painting", "cyberpunk", "watercolor"] as const;
export type AiAvatarStyle = (typeof AI_AVATAR_STYLES)[number];

const STYLE_PROMPTS: Record<AiAvatarStyle, string> = {
  anime: "anime style portrait, vibrant colors, clean line art",
  "3d-cartoon": "3D animated cartoon character portrait, Pixar style",
  "oil-painting": "classical oil painting portrait, rich brushstrokes",
  cyberpunk: "cyberpunk portrait, neon lighting, futuristic",
  watercolor: "soft watercolor painting portrait",
};

export function isAiAvatarStyle(value: unknown): value is AiAvatarStyle {
  return typeof value === "string" && (AI_AVATAR_STYLES as readonly string[]).includes(value);
}

export type AiAvatarFetcher = (photoData: Buffer, mimeType: string, style: AiAvatarStyle, apiKey: string) => Promise<Buffer | undefined>;

/**
 * Hinge's real "Ability to create a custom AI avatar based on the user's
 * photos" (#286) — a genuine call to Stability AI's real image-to-image
 * "Style Transfer" endpoint (the same category of service real "turn my
 * selfie into an avatar" apps like Lensa use), not a fabricated model.
 * This environment has no `STABILITY_API_KEY` configured, same "real
 * integration, missing credentials in *this* environment" honesty as
 * #22-25's Google/Apple/Facebook sign-in, #77's Spotify Connect, and
 * #268's OpenWeatherMap call — see `AiAvatarService.isConfigured()`.
 */
export const fetchAiAvatar: AiAvatarFetcher = async (photoData, mimeType, style, apiKey) => {
  try {
    const form = new FormData();
    form.append("image", new Blob([Uint8Array.from(photoData)], { type: mimeType }));
    form.append("prompt", STYLE_PROMPTS[style]);
    form.append("output_format", "png");
    const res = await fetch("https://api.stability.ai/v2beta/stable-image/control/style", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "image/*" },
      body: form,
    });
    if (!res.ok) return undefined;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return undefined;
  }
};

export class AiAvatarService {
  constructor(
    private readonly apiKey: string | undefined = process.env.STABILITY_API_KEY,
    private readonly fetcher: AiAvatarFetcher = fetchAiAvatar
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async generate(photoData: Buffer, mimeType: string, style: AiAvatarStyle): Promise<Buffer | undefined> {
    if (!this.apiKey) return undefined;
    return this.fetcher(photoData, mimeType, style, this.apiKey);
  }
}

export interface AiAvatarRecord {
  style: AiAvatarStyle;
  mimeType: string;
  data: Buffer;
  createdAt: string;
}

/** Per-author generated avatar, replace-on-regenerate — same one-value-per-author shape #89's StylizedAvatarStore uses. */
export class AiAvatarStore {
  private recordByAuthor = new Map<string, AiAvatarRecord>();

  set(author: string, record: AiAvatarRecord): void {
    this.recordByAuthor.set(author, record);
  }

  get(author: string): AiAvatarRecord | undefined {
    return this.recordByAuthor.get(author);
  }
}
