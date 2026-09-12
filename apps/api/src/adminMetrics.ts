export interface AdminMetrics {
  totalUsers: number;
  totalMatches: number;
  totalMessages: number;
  totalReports: number;
  totalBlocks: number;
}

/**
 * Tinder's real "Comprehensive admin dashboard with analytical charts"
 * (#171) — the first issue in this backlog's "Admin Panel & Moderation"
 * category. The implementation guide's "fine-grained RBAC and full audit
 * logging" plus an "ML pre-screening service" are production-scale infra
 * this environment has no user/role/permission system or ML model to
 * build on top of — every identity in this app is still a guest chat
 * author or a single-role signed-in user, never an "admin" role — same
 * honest scoping call as this app's other environment-gated features
 * (Google/Apple Sign-In, translation). What's real here: every number
 * below is a genuine live count pulled from this app's actual stores
 * (UserStore, SwipeStore, messagesByRoom, ReportStore, BlockStore) at
 * request time, not fabricated sample data — see server.ts's
 * GET /api/admin/metrics for how they're assembled, and adminAuth.ts for
 * the access gate in front of it.
 */
export function buildAdminMetrics(counts: AdminMetrics): AdminMetrics {
  return { ...counts };
}

/**
 * A single shared secret (ADMIN_API_KEY) an operator sets in .env,
 * checked via the x-admin-key header. Unset means the entire admin
 * surface 503s rather than being silently open — the same fail-closed
 * default GoogleAuthService/AppleAuthService use for their own
 * credential gates, not a real multi-tier RBAC system.
 */
export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_API_KEY);
}

export function isValidAdminKey(providedKey: unknown): boolean {
  return isAdminConfigured() && typeof providedKey === "string" && providedKey === process.env.ADMIN_API_KEY;
}
