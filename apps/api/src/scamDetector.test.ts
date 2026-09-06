import { test } from "node:test";
import assert from "node:assert/strict";
import { scanForScamContent } from "./scamDetector";

test("ordinary conversation is not flagged", () => {
  assert.deepEqual(scanForScamContent("Hey, how was your weekend?"), { flagged: false });
});

test("flags a legacy Bitcoin address", () => {
  const result = scanForScamContent("send it to 1BoatSLRHtKNngkdXEeobR76b53LETtpyT please");
  assert.equal(result.flagged, true);
  assert.equal(result.reason, "crypto_wallet_address");
});

test("flags a bech32 Bitcoin address", () => {
  const result = scanForScamContent("wallet: bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq");
  assert.equal(result.flagged, true);
  assert.equal(result.reason, "crypto_wallet_address");
});

test("flags an Ethereum address", () => {
  const result = scanForScamContent("send eth to 0x742d35Cc6634C0532925a3b844Bc454e4438f44e");
  assert.equal(result.flagged, true);
  assert.equal(result.reason, "crypto_wallet_address");
});

test("flags a common scam phrase", () => {
  const result = scanForScamContent("I know a guaranteed return investment opportunity for you");
  assert.equal(result.flagged, true);
  assert.equal(result.reason, "scam_phrase");
});

test("scam phrase matching is case-insensitive", () => {
  assert.equal(scanForScamContent("GUARANTEED PROFIT if you join now").flagged, true);
});

test("mentioning crypto casually is not flagged on its own", () => {
  assert.equal(scanForScamContent("I bought some crypto last year, it's been fun to follow").flagged, false);
});
