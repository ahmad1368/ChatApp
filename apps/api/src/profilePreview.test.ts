import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProfilePreview, ProfilePreviewInput } from "./profilePreview";

function emptyInput(): ProfilePreviewInput {
  return {
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
    spotifyInfo: { connected: false, topTracks: [], hideSpotify: false },
    instagramInfo: { connected: false, posts: [], hideInstagram: false },
    interestsInfo: { interests: [], hideInterests: false },
  };
}

test("buildProfilePreview() returns an empty object when nothing is set", () => {
  assert.deepEqual(buildProfilePreview(emptyInput()), {});
});

test("buildProfilePreview() includes bio when set", () => {
  const input = emptyInput();
  input.bio = "Loves hiking";
  assert.deepEqual(buildProfilePreview(input), { bio: "Loves hiking" });
});

test("buildProfilePreview() shows job title but hides company when hideCompany is set", () => {
  const input = emptyInput();
  input.jobInfo = { jobTitle: "Engineer", company: "Acme", hideCompany: true };
  assert.deepEqual(buildProfilePreview(input), { jobTitle: "Engineer" });
});

test("buildProfilePreview() shows both job title and company when not hidden", () => {
  const input = emptyInput();
  input.jobInfo = { jobTitle: "Engineer", company: "Acme", hideCompany: false };
  assert.deepEqual(buildProfilePreview(input), { jobTitle: "Engineer", company: "Acme" });
});

test("buildProfilePreview() omits school when hideSchool is set", () => {
  const input = emptyInput();
  input.educationInfo = { school: "State University", hideSchool: true };
  assert.deepEqual(buildProfilePreview(input), {});
});

test("buildProfilePreview() omits height when hideHeight is set", () => {
  const input = emptyInput();
  input.heightInfo = { heightCm: 170, hideHeight: true };
  assert.deepEqual(buildProfilePreview(input), {});
});

test("buildProfilePreview() includes height when not hidden", () => {
  const input = emptyInput();
  input.heightInfo = { heightCm: 170, hideHeight: false };
  assert.deepEqual(buildProfilePreview(input), { heightCm: 170 });
});

test("buildProfilePreview() respects independent smoking/drinking hide flags", () => {
  const input = emptyInput();
  input.lifestyleInfo = { smoking: "no", drinking: "yes", hideSmoking: true, hideDrinking: false };
  assert.deepEqual(buildProfilePreview(input), { drinking: "yes" });
});

test("buildProfilePreview() omits Spotify when not connected even if hideSpotify is false", () => {
  const input = emptyInput();
  input.spotifyInfo = { connected: false, topTracks: [], hideSpotify: false };
  assert.deepEqual(buildProfilePreview(input), {});
});

test("buildProfilePreview() includes Spotify top tracks when connected and not hidden", () => {
  const input = emptyInput();
  input.spotifyInfo = { connected: true, topTracks: ["Song A"], hideSpotify: false };
  assert.deepEqual(buildProfilePreview(input), { spotifyTopTracks: ["Song A"] });
});

test("buildProfilePreview() omits Instagram when hideInstagram is set even though connected", () => {
  const input = emptyInput();
  input.instagramInfo = { connected: true, posts: ["https://instagram.com/p/1"], hideInstagram: true };
  assert.deepEqual(buildProfilePreview(input), {});
});

test("buildProfilePreview() omits empty language/pet/interest lists", () => {
  const input = emptyInput();
  input.languagesInfo = { languages: [], hideLanguages: false };
  input.petsInfo = { pets: [], hidePets: false };
  input.interestsInfo = { interests: [], hideInterests: false };
  assert.deepEqual(buildProfilePreview(input), {});
});

test("buildProfilePreview() includes non-empty language/pet/interest lists when not hidden", () => {
  const input = emptyInput();
  input.languagesInfo = { languages: ["english", "spanish"], hideLanguages: false };
  input.petsInfo = { pets: ["dog"], hidePets: false };
  input.interestsInfo = { interests: ["hiking"], hideInterests: false };
  assert.deepEqual(buildProfilePreview(input), {
    languages: ["english", "spanish"],
    pets: ["dog"],
    interests: ["hiking"],
  });
});

test("buildProfilePreview() combines every visible field into one object", () => {
  const input: ProfilePreviewInput = {
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
    spotifyInfo: { connected: true, topTracks: ["Song A"], hideSpotify: false },
    instagramInfo: { connected: true, posts: ["https://instagram.com/p/1"], hideInstagram: false },
    interestsInfo: { interests: ["hiking"], hideInterests: false },
  };
  assert.deepEqual(buildProfilePreview(input), {
    bio: "Loves hiking",
    jobTitle: "Engineer",
    company: "Acme",
    school: "State University",
    heightCm: 170,
    smoking: "no",
    drinking: "sometimes",
    familyPlans: "wantChildren",
    zodiacSign: "cancer",
    languages: ["english"],
    religion: "buddhist",
    politicalView: "moderate",
    pets: ["dog"],
    mbtiType: "INFP",
    enneagramType: 4,
    spotifyTopTracks: ["Song A"],
    instagramPosts: ["https://instagram.com/p/1"],
    interests: ["hiking"],
  });
});
