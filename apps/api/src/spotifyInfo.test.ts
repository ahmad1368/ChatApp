import { test } from "node:test";
import assert from "node:assert/strict";
import { SpotifyInfoStore } from "./spotifyInfo";

test("get() returns empty fields before any connection", () => {
  const store = new SpotifyInfoStore();
  assert.deepEqual(store.get("alice"), { connected: false, topTracks: [], moodValence: null, moodEnergy: null, hideSpotify: false });
});

test("connect() marks the author connected and stores top tracks", () => {
  const store = new SpotifyInfoStore();
  const result = store.connect("alice", ["Song A", "Song B"]);
  assert.deepEqual(result, {
    connected: true,
    topTracks: ["Song A", "Song B"],
    moodValence: null,
    moodEnergy: null,
    hideSpotify: false,
  });
  assert.deepEqual(store.get("alice"), result);
});

test("connect() stores real mood averages when provided", () => {
  const store = new SpotifyInfoStore();
  const result = store.connect("alice", ["Song A"], 0.6, 0.7);
  assert.deepEqual(result, { connected: true, topTracks: ["Song A"], moodValence: 0.6, moodEnergy: 0.7, hideSpotify: false });
});

test("disconnect() clears top tracks and mood, and marks the author disconnected", () => {
  const store = new SpotifyInfoStore();
  store.connect("alice", ["Song A"], 0.6, 0.7);
  const result = store.disconnect("alice");
  assert.deepEqual(result, { connected: false, topTracks: [], moodValence: null, moodEnergy: null, hideSpotify: false });
});

test("disconnect() preserves an existing hideSpotify preference", () => {
  const store = new SpotifyInfoStore();
  store.connect("alice", ["Song A"]);
  store.setHideSpotify("alice", true);
  const result = store.disconnect("alice");
  assert.deepEqual(result, { connected: false, topTracks: [], moodValence: null, moodEnergy: null, hideSpotify: true });
});

test("setHideSpotify() updates the hide flag without touching connection state", () => {
  const store = new SpotifyInfoStore();
  store.connect("alice", ["Song A"], 0.6, 0.7);
  const result = store.setHideSpotify("alice", true);
  assert.deepEqual(result, { connected: true, topTracks: ["Song A"], moodValence: 0.6, moodEnergy: 0.7, hideSpotify: true });
});

test("reconnecting replaces the previous top tracks and mood", () => {
  const store = new SpotifyInfoStore();
  store.connect("alice", ["Song A"], 0.6, 0.7);
  const result = store.connect("alice", ["Song B", "Song C"], 0.2, 0.3);
  assert.deepEqual(result, {
    connected: true,
    topTracks: ["Song B", "Song C"],
    moodValence: 0.2,
    moodEnergy: 0.3,
    hideSpotify: false,
  });
});

test("each author's Spotify info is independent", () => {
  const store = new SpotifyInfoStore();
  store.connect("alice", ["Song A"]);
  assert.deepEqual(store.get("bob"), { connected: false, topTracks: [], moodValence: null, moodEnergy: null, hideSpotify: false });
});
