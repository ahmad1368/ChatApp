import { test } from "node:test";
import assert from "node:assert/strict";
import { PartnerVenueDiscountStore, PARTNER_VENUES } from "./partnerVenueDiscounts";

test("listVenues returns the fixed partner catalog", () => {
  const store = new PartnerVenueDiscountStore();
  assert.deepEqual(store.listVenues(), PARTNER_VENUES);
});

test("claim rejects an unknown venue", () => {
  const store = new PartnerVenueDiscountStore();
  const result = store.claim("alice", "not-a-real-venue");
  assert.equal(result.success, false);
});

test("claim succeeds for a known venue and returns a code", () => {
  const store = new PartnerVenueDiscountStore();
  const result = store.claim("alice", "bellas-bistro");
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.venue.id, "bellas-bistro");
    assert.match(result.code, /^[0-9A-F]{8}$/);
  }
});

test("claim is idempotent — a second claim returns the same code", () => {
  const store = new PartnerVenueDiscountStore();
  const first = store.claim("alice", "bellas-bistro");
  const second = store.claim("alice", "bellas-bistro");
  assert.equal(first.success, true);
  assert.equal(second.success, true);
  if (first.success && second.success) {
    assert.equal(first.code, second.code);
  }
});

test("getClaim returns null before any claim", () => {
  const store = new PartnerVenueDiscountStore();
  assert.equal(store.getClaim("alice", "bellas-bistro"), null);
});

test("getClaim returns the claimed code", () => {
  const store = new PartnerVenueDiscountStore();
  const claimed = store.claim("alice", "bellas-bistro");
  assert.equal(claimed.success, true);
  if (!claimed.success) return;
  assert.equal(store.getClaim("alice", "bellas-bistro"), claimed.code);
});

test("claims are tracked independently per author", () => {
  const store = new PartnerVenueDiscountStore();
  store.claim("alice", "bellas-bistro");
  assert.equal(store.getClaim("bob", "bellas-bistro"), null);
});

test("claims are tracked independently per venue", () => {
  const store = new PartnerVenueDiscountStore();
  store.claim("alice", "bellas-bistro");
  assert.equal(store.getClaim("alice", "the-grind-cafe"), null);
});
