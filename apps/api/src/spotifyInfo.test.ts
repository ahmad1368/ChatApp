import { test } from "node:test";
import assert from "node:assert/strict";
import { SpotifyInfoStore } from "./spotifyInfo";

test("get() returns empty fields before any connection", () => {
  const store = new SpotifyInfoStore();
  assert.deepEqual(store.get("alice"), { connected: false, topTracks: [], hideSpotify: false });
});

test("connect() marks the author connected and stores top tracks", () => {
  const store = new SpotifyInfoStore();
  const result = store.connect("alice", ["Song A", "Song B"]);
  assert.deepEqual(result, { connected: true, topTracks: ["Song A", "Song B"], hideSpotify: false });
  assert.deepEqual(store.get("alice"), { connected: true, topTracks: ["Song A", "Song B"], hideSpotify: false });
});

test("disconnect() clears top tracks and marks the author disconnected", () => {
  const store = new SpotifyInfoStore();
  store.connect("alice", ["Song A"]);
  const result = store.disconnect("alice");
  assert.deepEqual(result, { connected: false, topTracks: [], hideSpotify: false });
});

test("disconnect() preserves an existing hideSpotify preference", () => {
  const store = new SpotifyInfoStore();
  store.connect("alice", ["Song A"]);
  store.setHideSpotify("alice", true);
  const result = store.disconnect("alice");
  assert.deepEqual(result, { connected: false, topTracks: [], hideSpotify: true });
});

test("setHideSpotify() updates the hide flag without touching connection state", () => {
  const store = new SpotifyInfoStore();
  store.connect("alice", ["Song A"]);
  const result = store.setHideSpotify("alice", true);
  assert.deepEqual(result, { connected: true, topTracks: ["Song A"], hideSpotify: true });
});

test("reconnecting replaces the previous top tracks", () => {
  const store = new SpotifyInfoStore();
  store.connect("alice", ["Song A"]);
  const result = store.connect("alice", ["Song B", "Song C"]);
  assert.deepEqual(result, { connected: true, topTracks: ["Song B", "Song C"], hideSpotify: false });
});

test("each author's Spotify info is independent", () => {
  const store = new SpotifyInfoStore();
  store.connect("alice", ["Song A"]);
  assert.deepEqual(store.get("bob"), { connected: false, topTracks: [], hideSpotify: false });
});
