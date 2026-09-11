import { test } from "node:test";
import assert from "node:assert/strict";
import { DATE_PROPOSAL_LABELS, isDateProposalCategory } from "./dateProposals";
import { DATE_PROPOSAL_CATEGORIES } from "@chatapp/shared";

test("isDateProposalCategory() accepts every catalog category", () => {
  for (const category of DATE_PROPOSAL_CATEGORIES) {
    assert.equal(isDateProposalCategory(category), true);
  }
});

test("isDateProposalCategory() rejects an unknown category", () => {
  assert.equal(isDateProposalCategory("skydiving"), false);
});

test("isDateProposalCategory() rejects a non-string value", () => {
  assert.equal(isDateProposalCategory(42), false);
});

test("every catalog category has a label", () => {
  for (const category of DATE_PROPOSAL_CATEGORIES) {
    assert.equal(typeof DATE_PROPOSAL_LABELS[category], "string");
    assert.ok(DATE_PROPOSAL_LABELS[category].length > 0);
  }
});
