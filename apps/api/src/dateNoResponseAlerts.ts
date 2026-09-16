export interface DateNoResponseAlertRecord {
  dateId: string;
  contactName: string;
  phone: string;
  message: string;
  sentAt: string;
}

/**
 * Tinder's real "Automatic SMS alert system if there's no response after
 * a date" (#314) — fired by server.ts's periodic sweep of
 * `SharedDateStore.getDatesNeedingNoResponseAlert()`, one text per
 * trusted contact who left a real phone number (#314's real extension to
 * #47's `SharedDateStore.contacts`). Same stubbed-delivery pattern as
 * `smsSecurityAlerts.ts`/`sos.ts`/`auth.ts`'s OtpService: no real SMS
 * provider (Twilio, etc.) has credentials in this environment, so
 * "sending" means logging the message and recording it here so a
 * client/test can verify what would have gone out.
 */
export class DateNoResponseAlertStore {
  private alertsByDateId = new Map<string, DateNoResponseAlertRecord[]>();

  send(dateId: string, contactName: string, phone: string, message: string): void {
    const record: DateNoResponseAlertRecord = { dateId, contactName, phone, message, sentAt: new Date().toISOString() };
    const existing = this.alertsByDateId.get(dateId) ?? [];
    existing.push(record);
    this.alertsByDateId.set(dateId, existing);

    // Stand-in for a real SMS provider — same pattern as smsSecurityAlerts.ts.
    console.log(`[date-no-response-alert] ${phone}: ${message}`);
  }

  getSentAlerts(dateId: string): DateNoResponseAlertRecord[] {
    return this.alertsByDateId.get(dateId) ?? [];
  }
}
