import { randomBytes } from "crypto";
import { EmergencyContact, SOSAlert, SOSAlertView, SOSLocation } from "@chatapp/shared";

export type AddContactResult = { success: true; contact: EmergencyContact } | { success: false; error: string };
export type TriggerSOSResult = { success: true; alert: SOSAlert } | { success: false; error: string };
export type UpdateLocationResult = { success: true; alert: SOSAlert } | { success: false; error: string };

interface InternalAlert extends Omit<SOSAlert, "contacts"> {
  contacts: { name: string; shareCode: string }[];
}

function parseLocation(payload: Record<string, unknown> | undefined): SOSLocation | undefined {
  const latitude = payload?.latitude;
  const longitude = payload?.longitude;
  const accuracy = payload?.accuracy;
  if (typeof latitude !== "number" || latitude < -90 || latitude > 90) return undefined;
  if (typeof longitude !== "number" || longitude < -180 || longitude > 180) return undefined;
  if (accuracy !== undefined && typeof accuracy !== "number") return undefined;
  return accuracy === undefined ? { latitude, longitude } : { latitude, longitude, accuracy };
}

/**
 * Emergency SOS: its own high-priority, dependency-free safety path with no
 * reliance on matching/discovery services. Triggering sends the sender's
 * current location to every registered emergency contact via a distinct
 * share code each (live-trackable, like #47's Share My Date), and (stubbed,
 * same pattern as SMS/email delivery elsewhere in this app) logs a
 * notification per contact rather than integrating a real SMS/push provider.
 */
export class SOSStore {
  private contactsByAuthor = new Map<string, EmergencyContact[]>();
  private alertsById = new Map<string, InternalAlert>();
  private alertIdByShareCode = new Map<string, string>();
  private nextId = 1;

  addContact(author: unknown, name: unknown, contactMethod: unknown): AddContactResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    const contactName = typeof name === "string" ? name.trim() : "";
    const method = typeof contactMethod === "string" ? contactMethod.trim() : "";
    if (!authorName) return { success: false, error: "author is required" };
    if (!contactName) return { success: false, error: "name is required" };
    if (!method) return { success: false, error: "contactMethod is required" };

    const contact: EmergencyContact = { name: contactName, contactMethod: method };
    const contacts = this.contactsByAuthor.get(authorName) ?? [];
    contacts.push(contact);
    this.contactsByAuthor.set(authorName, contacts);
    return { success: true, contact };
  }

  listContacts(author: string): EmergencyContact[] {
    return this.contactsByAuthor.get(author?.trim()) ?? [];
  }

  triggerSOS(author: unknown, payload: Record<string, unknown> | undefined): TriggerSOSResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    if (!authorName) return { success: false, error: "author is required" };

    const location = parseLocation(payload);
    if (!location) return { success: false, error: "A valid latitude and longitude are required" };

    const emergencyContacts = this.contactsByAuthor.get(authorName) ?? [];
    if (emergencyContacts.length === 0) {
      return { success: false, error: "No emergency contacts registered" };
    }

    const now = new Date().toISOString();
    const contacts = emergencyContacts.map((contact) => ({ name: contact.name, shareCode: randomBytes(4).toString("hex") }));
    const alert: InternalAlert = {
      id: String(this.nextId++),
      author: authorName,
      location,
      resolved: false,
      triggeredAt: now,
      updatedAt: now,
      contacts,
    };

    this.alertsById.set(alert.id, alert);
    contacts.forEach((contact, index) => {
      this.alertIdByShareCode.set(contact.shareCode, alert.id);
      const method = emergencyContacts[index].contactMethod;
      // Stubbed delivery: a real integration would send SMS/push/email here.
      console.log(`[SOS] Notifying ${contact.name} (${method}): ${authorName} triggered an SOS alert.`);
    });

    return { success: true, alert: { ...alert } };
  }

  updateLocation(author: unknown, id: string, payload: Record<string, unknown> | undefined): UpdateLocationResult {
    const authorName = typeof author === "string" ? author.trim() : "";
    const alert = this.alertsById.get(id);
    if (!alert) return { success: false, error: "Alert not found" };
    if (alert.author !== authorName) return { success: false, error: "Only the alert owner can update location" };
    if (alert.resolved) return { success: false, error: "Alert has already been resolved" };

    const location = parseLocation(payload);
    if (!location) return { success: false, error: "A valid latitude and longitude are required" };

    alert.location = location;
    alert.updatedAt = new Date().toISOString();
    return { success: true, alert: { ...alert } };
  }

  resolve(author: unknown, id: string): boolean {
    const authorName = typeof author === "string" ? author.trim() : "";
    const alert = this.alertsById.get(id);
    if (!alert || alert.author !== authorName) return false;
    alert.resolved = true;
    alert.updatedAt = new Date().toISOString();
    return true;
  }

  viewByShareCode(shareCode: string): SOSAlertView | undefined {
    const id = this.alertIdByShareCode.get(shareCode);
    if (!id) return undefined;
    const alert = this.alertsById.get(id);
    if (!alert) return undefined;
    const { author, location, resolved, triggeredAt, updatedAt } = alert;
    return { author, location, resolved, triggeredAt, updatedAt };
  }
}
