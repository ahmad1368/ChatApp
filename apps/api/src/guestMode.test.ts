import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isGuestSendAllowed } from "./guestMode";

describe("isGuestSendAllowed", () => {
  it("disallows a send explicitly flagged as a guest", () => {
    assert.equal(isGuestSendAllowed({ asGuest: true }), false);
  });

  it("allows a send with asGuest explicitly false", () => {
    assert.equal(isGuestSendAllowed({ asGuest: false }), true);
  });

  it("allows a send with asGuest omitted (existing non-guest clients)", () => {
    assert.equal(isGuestSendAllowed({}), true);
  });
});
