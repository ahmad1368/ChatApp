"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth, loadStoredAuth } from "./authClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Category = "login" | "accountSecurity";

interface Preferences {
  login: boolean;
  accountSecurity: boolean;
}

interface AlertRecord {
  category: Category;
  message: string;
  phoneNumber: string;
  sentAt: string;
}

const LABELS: Record<Category, string> = {
  login: "New sign-ins",
  accountSecurity: "Account security changes (2FA, device logouts)",
};

/**
 * Bumble/Tinder-style SMS notifications for logins and account-security-
 * lowering events (#158). Delivery is stubbed server-side (no real SMS
 * provider credentials in this environment — see smsSecurityAlerts.ts), so
 * the "Recent alerts" list below is the only visible confirmation that a
 * text would have gone out.
 */
export default function SmsSecurityAlerts() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const auth = loadStoredAuth();

  useEffect(() => {
    if (!auth) return;
    fetchWithAuth(`${API_URL}/api/sms-security-alerts/preferences`)
      .then((res) => (res.ok ? res.json() : undefined))
      .then((body) => body && setPreferences(body.preferences))
      .catch(() => undefined);
    fetchWithAuth(`${API_URL}/api/sms-security-alerts/history`)
      .then((res) => (res.ok ? res.json() : undefined))
      .then((body) => body && setAlerts(body.alerts ?? []))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!auth) {
    return <p style={{ fontSize: 14, color: "#6b7280" }}>Sign in to manage SMS security alerts.</p>;
  }
  if (!preferences) {
    return null;
  }

  const toggle = async (category: Category) => {
    setError(null);
    const enabled = !preferences[category];
    const res = await fetchWithAuth(`${API_URL}/api/sms-security-alerts/preferences`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, enabled }),
    });
    if (!res.ok) {
      setError("Failed to update preference");
      return;
    }
    const body = await res.json();
    setPreferences(body.preferences);
  };

  return (
    <div style={{ maxWidth: 400 }}>
      <h2 style={{ fontSize: 16 }}>SMS security alerts</h2>
      <p style={{ fontSize: 13, color: "#6b7280" }}>
        Get a text to your phone on file for these events. On by default.
      </p>
      {(Object.keys(LABELS) as Category[]).map((category) => (
        <label key={category} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 14 }}>
          <input type="checkbox" checked={preferences[category]} onChange={() => toggle(category)} />
          {LABELS[category]}
        </label>
      ))}
      {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
      {alerts.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, marginTop: 16 }}>Recent alerts</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {[...alerts].reverse().map((alert, i) => (
              <li key={i} style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
                {new Date(alert.sentAt).toLocaleString()} — {alert.message}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
