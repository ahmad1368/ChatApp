import { randomBytes } from "crypto";
import { WatermarkSession } from "@chatapp/shared";

/**
 * No browser API can block or even detect an OS-level screenshot — there is no
 * web equivalent of Android's FLAG_SECURE or iOS screen-capture protection.
 * The realistic web mitigation (also called out in the reference app's own
 * implementation guide) is deterrence + traceability: stamp a short, per-viewing
 * -session trace code into the on-screen watermark so a leaked screenshot can be
 * traced back to who viewed it. `lookup()` is intentionally not exposed over
 * HTTP — it would let anyone unmask which author a trace code belongs to.
 */
export class WatermarkStore {
  private sessions = new Map<string, WatermarkSession>();

  issueTraceCode(author: unknown, roomId: unknown): WatermarkSession | undefined {
    const authorName = typeof author === "string" ? author.trim() : "";
    const room = typeof roomId === "string" ? roomId.trim() : "";
    if (!authorName || !room) return undefined;

    const traceCode = randomBytes(4).toString("hex");
    const session: WatermarkSession = {
      traceCode,
      author: authorName,
      roomId: room,
      issuedAt: new Date().toISOString(),
    };
    this.sessions.set(traceCode, session);
    return session;
  }

  lookup(traceCode: string): WatermarkSession | undefined {
    return this.sessions.get(traceCode);
  }
}
