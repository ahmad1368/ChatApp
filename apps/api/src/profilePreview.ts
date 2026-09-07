import { JobInfo } from "./jobInfo";
import { EducationInfo } from "./educationInfo";
import { HeightInfo } from "./heightInfo";
import { LifestyleInfo, SmokingOption, DrinkingOption } from "./lifestyleInfo";
import { FamilyPlansInfo, FamilyPlansOption } from "./familyPlansInfo";
import { ZodiacInfo, ZodiacSign } from "./zodiacInfo";
import { LanguagesInfo, Language } from "./languagesInfo";
import { BeliefsInfo, ReligionOption, PoliticalViewOption } from "./beliefsInfo";
import { PetsInfo, Pet } from "./petsInfo";
import { PersonalityInfo, MbtiType } from "./personalityInfo";
import { SpotifyInfo } from "./spotifyInfo";
import { InstagramInfo } from "./instagramInfo";
import { InterestsInfo, Interest } from "./interestsInfo";

export interface ProfilePreviewInput {
  bio: string;
  jobInfo: JobInfo;
  educationInfo: EducationInfo;
  heightInfo: HeightInfo;
  lifestyleInfo: LifestyleInfo;
  familyPlansInfo: FamilyPlansInfo;
  zodiacInfo: ZodiacInfo;
  languagesInfo: LanguagesInfo;
  beliefsInfo: BeliefsInfo;
  petsInfo: PetsInfo;
  personalityInfo: PersonalityInfo;
  spotifyInfo: SpotifyInfo;
  instagramInfo: InstagramInfo;
  interestsInfo: InterestsInfo;
}

export interface ProfilePreview {
  bio?: string;
  jobTitle?: string;
  company?: string;
  school?: string;
  heightCm?: number;
  smoking?: SmokingOption;
  drinking?: DrinkingOption;
  familyPlans?: FamilyPlansOption;
  zodiacSign?: ZodiacSign;
  languages?: Language[];
  religion?: ReligionOption;
  politicalView?: PoliticalViewOption;
  pets?: Pet[];
  mbtiType?: MbtiType;
  enneagramType?: number;
  spotifyTopTracks?: string[];
  instagramPosts?: string[];
  interests?: Interest[];
}

/**
 * "Preview profile as seen by other users" (#81) — composes every
 * standalone profile field this app tracks (#61-#79) into the single view
 * another user would actually see, respecting each field's own hide flag
 * (#67-#79) and #80's core hideAge/hideDistance toggles (not represented
 * here since this app has neither an age nor a distance value to show or
 * hide yet). A hidden or empty field is omitted entirely rather than sent
 * with a null/empty placeholder, so the client can render "not shared"
 * simply by checking for the key's absence.
 */
export function buildProfilePreview(input: ProfilePreviewInput): ProfilePreview {
  const preview: ProfilePreview = {};

  if (input.bio) preview.bio = input.bio;

  if (input.jobInfo.jobTitle) preview.jobTitle = input.jobInfo.jobTitle;
  if (input.jobInfo.company && !input.jobInfo.hideCompany) preview.company = input.jobInfo.company;

  if (input.educationInfo.school && !input.educationInfo.hideSchool) preview.school = input.educationInfo.school;

  if (input.heightInfo.heightCm !== null && !input.heightInfo.hideHeight) preview.heightCm = input.heightInfo.heightCm;

  if (input.lifestyleInfo.smoking && !input.lifestyleInfo.hideSmoking) preview.smoking = input.lifestyleInfo.smoking;
  if (input.lifestyleInfo.drinking && !input.lifestyleInfo.hideDrinking) preview.drinking = input.lifestyleInfo.drinking;

  if (input.familyPlansInfo.familyPlans && !input.familyPlansInfo.hideFamilyPlans) {
    preview.familyPlans = input.familyPlansInfo.familyPlans;
  }

  if (input.zodiacInfo.zodiacSign && !input.zodiacInfo.hideZodiac) preview.zodiacSign = input.zodiacInfo.zodiacSign;

  if (input.languagesInfo.languages.length > 0 && !input.languagesInfo.hideLanguages) {
    preview.languages = input.languagesInfo.languages;
  }

  if (input.beliefsInfo.religion && !input.beliefsInfo.hideReligion) preview.religion = input.beliefsInfo.religion;
  if (input.beliefsInfo.politicalView && !input.beliefsInfo.hidePoliticalView) {
    preview.politicalView = input.beliefsInfo.politicalView;
  }

  if (input.petsInfo.pets.length > 0 && !input.petsInfo.hidePets) preview.pets = input.petsInfo.pets;

  if (input.personalityInfo.mbtiType && !input.personalityInfo.hideMbti) preview.mbtiType = input.personalityInfo.mbtiType;
  if (input.personalityInfo.enneagramType !== null && !input.personalityInfo.hideEnneagram) {
    preview.enneagramType = input.personalityInfo.enneagramType;
  }

  if (input.spotifyInfo.connected && !input.spotifyInfo.hideSpotify) preview.spotifyTopTracks = input.spotifyInfo.topTracks;
  if (input.instagramInfo.connected && !input.instagramInfo.hideInstagram) preview.instagramPosts = input.instagramInfo.posts;

  if (input.interestsInfo.interests.length > 0 && !input.interestsInfo.hideInterests) {
    preview.interests = input.interestsInfo.interests;
  }

  return preview;
}
