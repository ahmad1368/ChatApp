"use client";

import { useEffect, useState } from "react";
import { EmergencyContact, SOSAlert } from "@chatapp/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function SOSButton({ author }: { author: string }) {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [contactName, setContactName] = useState("");
  const [contactMethod, setContactMethod] = useState("");
  const [showContactForm, setShowContactForm] = useState(false);
  const [activeAlert, setActiveAlert] = useState<SOSAlert | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/sos/contacts/${encodeURIComponent(author)}`)
      .then((res) => res.json())
      .then((body) => setContacts(body.contacts ?? []))
      .catch(() => setContacts([]));
  }, [author]);

  const addContact = async () => {
    if (!contactName.trim() || !contactMethod.trim()) return;
    const res = await fetch(`${API_URL}/api/sos/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, name: contactName.trim(), contactMethod: contactMethod.trim() }),
    });
    if (res.ok) {
      setContacts((prev) => [...prev, { name: contactName.trim(), contactMethod: contactMethod.trim() }]);
      setContactName("");
      setContactMethod("");
    }
  };

  const triggerSOS = () => {
    setError(null);
    if (!navigator.geolocation) {
      setError("Geolocation isn't available in this browser.");
      return;
    }
    setTriggering(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const res = await fetch(`${API_URL}/api/sos/alerts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            author,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          }),
        });
        const body = await res.json();
        setTriggering(false);
        if (!res.ok) {
          setError(body.error ?? "Failed to trigger SOS");
          return;
        }
        setActiveAlert(body);
      },
      () => {
        setTriggering(false);
        setError("Couldn't get your location. Please enable location access and try again.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const resolveAlert = async () => {
    if (!activeAlert) return;
    await fetch(`${API_URL}/api/sos/alerts/${activeAlert.id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author }),
    });
    setActiveAlert(null);
  };

  return (
    <div style={{ border: "1px solid #b00020", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>
      {!activeAlert && (
        <>
          <button
            onClick={triggerSOS}
            disabled={triggering}
            style={{
              background: "#b00020",
              color: "white",
              border: "none",
              borderRadius: 6,
              padding: "10px 16px",
              fontWeight: "bold",
              cursor: "pointer",
              width: "100%",
            }}
          >
            {triggering ? "Getting your location…" : "🆘 Emergency SOS"}
          </button>
          <p style={{ color: "#666", marginTop: 6 }}>
            Sends your current location to your emergency contacts. {contacts.length} contact(s) registered.
          </p>
          <button onClick={() => setShowContactForm((v) => !v)} style={{ fontSize: 12 }}>
            {showContactForm ? "Hide" : "Manage"} emergency contacts
          </button>
          {showContactForm && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              <ul style={{ paddingLeft: 16, margin: 0 }}>
                {contacts.map((c) => (
                  <li key={c.name + c.contactMethod}>
                    {c.name} ({c.contactMethod})
                  </li>
                ))}
              </ul>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Name"
                  style={{ flex: 1, padding: 6 }}
                />
                <input
                  value={contactMethod}
                  onChange={(e) => setContactMethod(e.target.value)}
                  placeholder="Phone or email"
                  style={{ flex: 1, padding: 6 }}
                />
                <button onClick={addContact}>Add</button>
              </div>
            </div>
          )}
          {error && <p style={{ color: "#b00020" }}>{error}</p>}
        </>
      )}
      {activeAlert && (
        <div>
          <p style={{ fontWeight: "bold", color: "#b00020" }}>SOS active — contacts notified.</p>
          <ul style={{ fontSize: 12 }}>
            {activeAlert.contacts.map((contact) => (
              <li key={contact.shareCode}>
                {contact.name}: {`${typeof window !== "undefined" ? window.location.origin : ""}/sos/shared/${contact.shareCode}`}
              </li>
            ))}
          </ul>
          <button onClick={resolveAlert}>I&apos;m safe now — end SOS</button>
        </div>
      )}
    </div>
  );
}
