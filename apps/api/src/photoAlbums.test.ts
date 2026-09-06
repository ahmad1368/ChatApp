import { test } from "node:test";
import assert from "node:assert/strict";
import { PhotoAlbumStore } from "./photoAlbums";

test("defaults to public with no explicit access level", () => {
  const store = new PhotoAlbumStore();
  assert.equal(store.getAccessLevel("alice"), "public");
  assert.equal(store.canView("bob", "alice"), true);
});

test("setAccessLevel() rejects an invalid level", () => {
  const store = new PhotoAlbumStore();
  const result = store.setAccessLevel("alice", "hidden");
  assert.equal(result.success, false);
});

test("setAccessLevel() rejects a missing owner", () => {
  const store = new PhotoAlbumStore();
  const result = store.setAccessLevel("", "private");
  assert.equal(result.success, false);
});

test("private album hides photos from everyone but the owner", () => {
  const store = new PhotoAlbumStore();
  store.setAccessLevel("alice", "private");
  assert.equal(store.canView("alice", "alice"), true);
  assert.equal(store.canView("bob", "alice"), false);
});

test("requestAccess() is rejected unless the album is in request-access mode", () => {
  const store = new PhotoAlbumStore();
  const result = store.requestAccess("bob", "alice");
  assert.equal(result.success, false);
});

test("requestAccess() rejects requesting your own album", () => {
  const store = new PhotoAlbumStore();
  store.setAccessLevel("alice", "requestAccess");
  const result = store.requestAccess("alice", "alice");
  assert.equal(result.success, false);
});

test("a pending request grants no access until approved", () => {
  const store = new PhotoAlbumStore();
  store.setAccessLevel("alice", "requestAccess");
  store.requestAccess("bob", "alice");
  assert.deepEqual(store.listPendingRequests("alice"), ["bob"]);
  assert.equal(store.canView("bob", "alice"), false);
});

test("approving a request grants access and clears the pending entry", () => {
  const store = new PhotoAlbumStore();
  store.setAccessLevel("alice", "requestAccess");
  store.requestAccess("bob", "alice");
  const result = store.respondToRequest("alice", "bob", true);
  assert.equal(result.success, true);
  assert.equal(store.canView("bob", "alice"), true);
  assert.deepEqual(store.listPendingRequests("alice"), []);
});

test("denying a request leaves access unchanged and clears the pending entry", () => {
  const store = new PhotoAlbumStore();
  store.setAccessLevel("alice", "requestAccess");
  store.requestAccess("bob", "alice");
  store.respondToRequest("alice", "bob", false);
  assert.equal(store.canView("bob", "alice"), false);
  assert.deepEqual(store.listPendingRequests("alice"), []);
});

test("respondToRequest() rejects when there's no matching pending request", () => {
  const store = new PhotoAlbumStore();
  const result = store.respondToRequest("alice", "bob", true);
  assert.equal(result.success, false);
});

test("switching an album back to public grants access to everyone again", () => {
  const store = new PhotoAlbumStore();
  store.setAccessLevel("alice", "private");
  assert.equal(store.canView("bob", "alice"), false);
  store.setAccessLevel("alice", "public");
  assert.equal(store.canView("bob", "alice"), true);
});

test("listPhotos() starts empty", () => {
  const store = new PhotoAlbumStore();
  assert.deepEqual(store.listPhotos("alice"), []);
});

test("addPhoto() appends in order", () => {
  const store = new PhotoAlbumStore();
  store.addPhoto("alice", "1");
  const result = store.addPhoto("alice", "2");
  assert.equal(result.success, true);
  assert.deepEqual(store.listPhotos("alice"), ["1", "2"]);
});

test("addPhoto() rejects a duplicate photoId", () => {
  const store = new PhotoAlbumStore();
  store.addPhoto("alice", "1");
  const result = store.addPhoto("alice", "1");
  assert.equal(result.success, false);
});

test("addPhoto() rejects a missing owner or photoId", () => {
  const store = new PhotoAlbumStore();
  assert.equal(store.addPhoto("", "1").success, false);
  assert.equal(store.addPhoto("alice", "").success, false);
});

test("addPhoto() caps an album at 9 photos", () => {
  const store = new PhotoAlbumStore();
  for (let i = 0; i < 9; i++) {
    assert.equal(store.addPhoto("alice", String(i)).success, true);
  }
  const result = store.addPhoto("alice", "overflow");
  assert.equal(result.success, false);
  assert.equal(store.listPhotos("alice").length, 9);
});

test("removePhoto() removes a photo and leaves the rest in order", () => {
  const store = new PhotoAlbumStore();
  store.addPhoto("alice", "1");
  store.addPhoto("alice", "2");
  store.addPhoto("alice", "3");
  const result = store.removePhoto("alice", "2");
  assert.equal(result.success, true);
  assert.deepEqual(store.listPhotos("alice"), ["1", "3"]);
});

test("removing a photo frees a slot for a new one", () => {
  const store = new PhotoAlbumStore();
  for (let i = 0; i < 9; i++) store.addPhoto("alice", String(i));
  store.removePhoto("alice", "0");
  const result = store.addPhoto("alice", "new-photo");
  assert.equal(result.success, true);
  assert.equal(store.listPhotos("alice").length, 9);
});

test("each owner's album is independent", () => {
  const store = new PhotoAlbumStore();
  store.addPhoto("alice", "1");
  store.addPhoto("bob", "2");
  assert.deepEqual(store.listPhotos("alice"), ["1"]);
  assert.deepEqual(store.listPhotos("bob"), ["2"]);
});
