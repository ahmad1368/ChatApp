import { randomUUID, randomBytes } from "crypto";

export const ADMIN_ROLES = ["superadmin", "moderator", "support", "finance"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

const MAX_NAME_LENGTH = 60;

export interface AdminAccount {
  id: string;
  name: string;
  role: AdminRole;
  apiKey: string;
  createdAt: string;
  revoked: boolean;
}

export type PublicAdminAccount = Omit<AdminAccount, "apiKey">;

export type CreateAccountResult = { success: true; account: AdminAccount } | { success: false; error: string };

function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}

function toPublic(account: AdminAccount): PublicAdminAccount {
  const { apiKey: _apiKey, ...publicAccount } = account;
  return publicAccount;
}

/**
 * Bumble's real "Manage admin access roles (RBAC)" (#187) — the actual
 * multi-tier RBAC that #171's `adminMetrics.ts` disclosed this app
 * didn't have yet ("a single shared secret... not a real multi-tier
 * RBAC system"). A named admin account gets its own generated API key
 * and one fixed role; the pre-existing `ADMIN_API_KEY` env var still
 * works exactly as before as the implicit, always-superadmin bootstrap
 * key (see `getAdminRole` in server.ts), so none of the ~20 existing
 * admin endpoint groups regress. Retrofitting every one of those routes
 * to a specific non-superadmin role is future, route-by-route work —
 * this delivers the account CRUD and the `requireRole` enforcement
 * primitive itself, demonstrated on the CRUD's own endpoints (list is
 * readable by superadmin or moderator; create/revoke need superadmin).
 */
export class AdminRoleStore {
  private byId = new Map<string, AdminAccount>();
  private byApiKey = new Map<string, AdminAccount>();

  create(name: unknown, role: unknown): CreateAccountResult {
    const nameText = typeof name === "string" ? name.trim() : "";
    if (!nameText) return { success: false, error: "name is required" };
    if (nameText.length > MAX_NAME_LENGTH) return { success: false, error: `name must be ${MAX_NAME_LENGTH} characters or fewer` };
    if (!isAdminRole(role)) return { success: false, error: `role must be one of: ${ADMIN_ROLES.join(", ")}` };

    const account: AdminAccount = {
      id: randomUUID(),
      name: nameText,
      role,
      apiKey: randomBytes(24).toString("hex"),
      createdAt: new Date().toISOString(),
      revoked: false,
    };
    this.byId.set(account.id, account);
    this.byApiKey.set(account.apiKey, account);
    return { success: true, account };
  }

  revoke(accountId: string): boolean {
    const account = this.byId.get(accountId);
    if (!account || account.revoked) return false;
    account.revoked = true;
    return true;
  }

  /** Newest first, never including the API key — the admin management view. */
  list(): PublicAdminAccount[] {
    return [...this.byId.values()].reverse().map(toPublic);
  }

  /** The role for a live (non-revoked) API key, or undefined. */
  findRoleByApiKey(apiKey: string): AdminRole | undefined {
    const account = this.byApiKey.get(apiKey);
    return account && !account.revoked ? account.role : undefined;
  }
}
