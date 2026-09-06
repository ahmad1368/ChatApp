import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RateLimiter } from "./rateLimiter";

describe("RateLimiter", () => {
  it("allows up to the configured limit within a window", () => {
    const limiter = new RateLimiter(3, 10_000);
    assert.equal(limiter.isAllowed("a"), true);
    assert.equal(limiter.isAllowed("a"), true);
    assert.equal(limiter.isAllowed("a"), true);
    assert.equal(limiter.isAllowed("a"), false);
  });

  it("tracks keys independently", () => {
    const limiter = new RateLimiter(1, 10_000);
    assert.equal(limiter.isAllowed("a"), true);
    assert.equal(limiter.isAllowed("b"), true);
    assert.equal(limiter.isAllowed("a"), false);
    assert.equal(limiter.isAllowed("b"), false);
  });

  it("resets once the window has elapsed", (t) => {
    t.mock.timers.enable({ apis: ["Date"] });
    const limiter = new RateLimiter(1, 1000);
    assert.equal(limiter.isAllowed("a"), true);
    assert.equal(limiter.isAllowed("a"), false);
    t.mock.timers.tick(1001);
    assert.equal(limiter.isAllowed("a"), true);
  });

  it("forgets a key after clear()", () => {
    const limiter = new RateLimiter(1, 10_000);
    assert.equal(limiter.isAllowed("a"), true);
    limiter.clear("a");
    assert.equal(limiter.isAllowed("a"), true);
  });
});
