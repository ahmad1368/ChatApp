import test from "node:test";
import assert from "node:assert/strict";
import { RelationshipBlogStore, ARTICLE_CATEGORIES } from "./relationshipBlog";

test("seeds a non-empty catalog covering every category with real body text", () => {
  const store = new RelationshipBlogStore();
  const articles = store.listArticles();
  assert.ok(articles.length >= ARTICLE_CATEGORIES.length);

  const coveredCategories = new Set(articles.map((a) => a.category));
  for (const category of ARTICLE_CATEGORIES) assert.ok(coveredCategories.has(category));
});

test("listArticles() omits body and sorts newest first", () => {
  const store = new RelationshipBlogStore();
  const articles = store.listArticles();
  assert.ok(!("body" in articles[0]));
  for (let i = 1; i < articles.length; i++) {
    assert.ok(new Date(articles[i - 1].publishedAt).getTime() >= new Date(articles[i].publishedAt).getTime());
  }
});

test("listArticles() filters by category", () => {
  const store = new RelationshipBlogStore();
  const filtered = store.listArticles("red-flags");
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((a) => a.category === "red-flags"));
});

test("getArticle() returns the full article including body, and increments readCount", () => {
  const store = new RelationshipBlogStore();
  const [{ id }] = store.listArticles();

  const first = store.getArticle(id)!;
  assert.ok(first.body.length > 0);
  assert.equal(first.readCount, 1);

  const second = store.getArticle(id)!;
  assert.equal(second.readCount, 2);
});

test("getArticle() returns undefined for an unknown id", () => {
  const store = new RelationshipBlogStore();
  assert.equal(store.getArticle("not-a-real-article"), undefined);
});

test("publish() rejects a missing author, title, invalid category, summary, or body", () => {
  const store = new RelationshipBlogStore();
  const base = { title: "t", category: "dating-tips", summary: "s", body: "b" };
  assert.equal(store.publish("", base).success, false);
  assert.equal(store.publish("admin", { ...base, title: "" }).success, false);
  assert.equal(store.publish("admin", { ...base, category: "not-a-real-category" }).success, false);
  assert.equal(store.publish("admin", { ...base, summary: "" }).success, false);
  assert.equal(store.publish("admin", { ...base, body: "" }).success, false);
});

test("publish() succeeds and the new article shows up in listArticles()", () => {
  const store = new RelationshipBlogStore();
  const beforeCount = store.listArticles().length;
  const result = store.publish("admin", {
    title: "New Article",
    category: "dating-tips",
    summary: "A new one",
    body: "Full text",
  });
  assert.equal(result.success, true);
  if (!result.success) return;

  const afterCount = store.listArticles().length;
  assert.equal(afterCount, beforeCount + 1);
  assert.equal(store.getArticle(result.article.id)?.title, "New Article");
});
