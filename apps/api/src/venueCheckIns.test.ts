import test from "node:test";
import assert from "node:assert/strict";
import { VenueCheckInStore, CHECKIN_DURATION_MS } from "./venueCheckIns";

test("checkIn() rejects a missing author or venue", () => {
  const store = new VenueCheckInStore();
  assert.equal(store.checkIn("", "Cafe X").success, false);
  assert.equal(store.checkIn("alice", "").success, false);
});

test("checkIn() succeeds and sets checkedInAt/expiresAt CHECKIN_DURATION_MS apart", () => {
  const store = new VenueCheckInStore();
  const now = Date.now();
  const result = store.checkIn("alice", "Cafe X", now);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.checkIn.venue, "Cafe X");
  assert.equal(new Date(result.checkIn.expiresAt).getTime() - new Date(result.checkIn.checkedInAt).getTime(), CHECKIN_DURATION_MS);
});

test("checking in somewhere new automatically checks you out of the old venue", () => {
  const store = new VenueCheckInStore();
  const now = Date.now();
  store.checkIn("alice", "Cafe X", now);
  store.checkIn("alice", "Gym Y", now);

  assert.deepEqual(
    store.getVenueCheckIns("Cafe X", now).map((c) => c.author),
    []
  );
  assert.deepEqual(
    store.getVenueCheckIns("Gym Y", now).map((c) => c.author),
    ["alice"]
  );
});

test("getMyCheckIn() returns the active check-in, or undefined once expired", () => {
  const store = new VenueCheckInStore();
  const now = Date.now();
  store.checkIn("alice", "Cafe X", now);

  assert.equal(store.getMyCheckIn("alice", now)?.venue, "Cafe X");
  assert.equal(store.getMyCheckIn("alice", now + CHECKIN_DURATION_MS + 1), undefined);
  assert.equal(store.getMyCheckIn("bob", now), undefined);
});

test("checkOut() ends an active check-in and rejects when there isn't one", () => {
  const store = new VenueCheckInStore();
  const now = Date.now();
  assert.equal(store.checkOut("alice", now).success, false);

  store.checkIn("alice", "Cafe X", now);
  assert.equal(store.checkOut("alice", now).success, true);
  assert.equal(store.getMyCheckIn("alice", now), undefined);

  assert.equal(store.checkOut("alice", now).success, false);
});

test("getVenueCheckIns() only returns active check-ins at that venue, most recent first", () => {
  const store = new VenueCheckInStore();
  const now = Date.now();
  store.checkIn("alice", "Cafe X", now);
  store.checkIn("bob", "Cafe X", now + 1000);
  store.checkIn("carol", "Gym Y", now);

  const atCafe = store.getVenueCheckIns("Cafe X", now + 1000);
  assert.deepEqual(atCafe.map((c) => c.author), ["bob", "alice"]);
});

test("listActiveVenues() reports only venues with a current check-in, busiest first", () => {
  const store = new VenueCheckInStore();
  const now = Date.now();
  store.checkIn("alice", "Cafe X", now);
  store.checkIn("bob", "Cafe X", now);
  store.checkIn("carol", "Gym Y", now);

  const venues = store.listActiveVenues(now);
  assert.deepEqual(venues, [
    { venue: "Cafe X", checkedInCount: 2 },
    { venue: "Gym Y", checkedInCount: 1 },
  ]);

  assert.deepEqual(store.listActiveVenues(now + CHECKIN_DURATION_MS + 1), []);
});
