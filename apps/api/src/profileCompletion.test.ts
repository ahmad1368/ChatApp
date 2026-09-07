import { test } from "node:test";
import assert from "node:assert/strict";
import { computeProfileCompletion, ProfileCompletionInput, PROFILE_COMPLETION_SECTIONS } from "./profileCompletion";

function emptyInput(): ProfileCompletionInput {
  return {
    hasPhoto: false,
    bio: "",
    jobInfo: { jobTitle: "", company: "", hideCompany: false },
    educationInfo: { school: "", hideSchool: false },
    heightInfo: { heightCm: null, hideHeight: false },
    lifestyleInfo: { smoking: null, drinking: null, hideSmoking: false, hideDrinking: false },
    familyPlansInfo: { familyPlans: null, hideFamilyPlans: false },
    zodiacInfo: { birthMonth: null, birthDay: null, zodiacSign: null, hideZodiac: false },
    languagesInfo: { languages: [], hideLanguages: false },
    beliefsInfo: { religion: null, politicalView: null, hideReligion: false, hidePoliticalView: false },
    petsInfo: { pets: [], hidePets: false },
    personalityInfo: { mbtiType: null, enneagramType: null, hideMbti: false, hideEnneagram: false },
    interestsInfo: { interests: [], hideInterests: false },
    promptAnswerCount: 0,
  };
}

test("computeProfileCompletion() is 0% for a completely empty profile", () => {
  const result = computeProfileCompletion(emptyInput());
  assert.equal(result.percentage, 0);
  assert.deepEqual(result.completedSections, []);
  assert.deepEqual(result.missingSections, [...PROFILE_COMPLETION_SECTIONS]);
});

test("computeProfileCompletion() is 100% when every section is filled", () => {
  const input: ProfileCompletionInput = {
    hasPhoto: true,
    bio: "Loves hiking",
    jobInfo: { jobTitle: "Engineer", company: "Acme", hideCompany: false },
    educationInfo: { school: "State University", hideSchool: false },
    heightInfo: { heightCm: 170, hideHeight: false },
    lifestyleInfo: { smoking: "no", drinking: "sometimes", hideSmoking: false, hideDrinking: false },
    familyPlansInfo: { familyPlans: "wantChildren", hideFamilyPlans: false },
    zodiacInfo: { birthMonth: 7, birthDay: 4, zodiacSign: "cancer", hideZodiac: false },
    languagesInfo: { languages: ["english"], hideLanguages: false },
    beliefsInfo: { religion: "buddhist", politicalView: "moderate", hideReligion: false, hidePoliticalView: false },
    petsInfo: { pets: ["dog"], hidePets: false },
    personalityInfo: { mbtiType: "INFP", enneagramType: 4, hideMbti: false, hideEnneagram: false },
    interestsInfo: { interests: ["hiking"], hideInterests: false },
    promptAnswerCount: 2,
  };
  const result = computeProfileCompletion(input);
  assert.equal(result.percentage, 100);
  assert.deepEqual(result.missingSections, []);
});

test("computeProfileCompletion() counts a hidden-but-filled field as complete", () => {
  const input = emptyInput();
  input.jobInfo = { jobTitle: "Engineer", company: "Acme", hideCompany: true };
  const result = computeProfileCompletion(input);
  assert.ok(result.completedSections.includes("job"));
});

test("computeProfileCompletion() reports a partially filled profile proportionally", () => {
  const input = emptyInput();
  input.bio = "Loves hiking";
  input.hasPhoto = true;
  const result = computeProfileCompletion(input);
  assert.deepEqual(result.completedSections.sort(), ["bio", "photo"].sort());
  assert.equal(result.percentage, Math.round((2 / PROFILE_COMPLETION_SECTIONS.length) * 100));
});

test("computeProfileCompletion() counts lifestyle as complete if only one of smoking/drinking is set", () => {
  const input = emptyInput();
  input.lifestyleInfo = { smoking: "no", drinking: null, hideSmoking: false, hideDrinking: false };
  const result = computeProfileCompletion(input);
  assert.ok(result.completedSections.includes("lifestyle"));
});
