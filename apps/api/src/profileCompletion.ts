import { JobInfo } from "./jobInfo";
import { EducationInfo } from "./educationInfo";
import { HeightInfo } from "./heightInfo";
import { LifestyleInfo } from "./lifestyleInfo";
import { FamilyPlansInfo } from "./familyPlansInfo";
import { ZodiacInfo } from "./zodiacInfo";
import { LanguagesInfo } from "./languagesInfo";
import { BeliefsInfo } from "./beliefsInfo";
import { PetsInfo } from "./petsInfo";
import { PersonalityInfo } from "./personalityInfo";
import { InterestsInfo } from "./interestsInfo";

export const PROFILE_COMPLETION_SECTIONS = [
  "photo",
  "bio",
  "job",
  "education",
  "height",
  "lifestyle",
  "familyPlans",
  "zodiac",
  "languages",
  "beliefs",
  "pets",
  "personality",
  "interests",
  "prompts",
] as const;
export type ProfileCompletionSection = (typeof PROFILE_COMPLETION_SECTIONS)[number];

export interface ProfileCompletionInput {
  hasPhoto: boolean;
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
  interestsInfo: InterestsInfo;
  promptAnswerCount: number;
}

export interface ProfileCompletion {
  percentage: number;
  completedSections: ProfileCompletionSection[];
  missingSections: ProfileCompletionSection[];
}

/**
 * "Measure profile completion percentage" (#86) — Hinge/LinkedIn's real
 * "profile strength" nudge. Reuses the same per-field getters as #81's
 * buildProfilePreview, but asks a different question: whether the owner
 * filled a section in at all, not whether it's currently visible to other
 * users, so hide flags (#67-#85) are irrelevant here — a hidden-but-filled
 * field still counts as complete.
 */
export function computeProfileCompletion(input: ProfileCompletionInput): ProfileCompletion {
  const completed = new Set<ProfileCompletionSection>();

  if (input.hasPhoto) completed.add("photo");
  if (input.bio) completed.add("bio");
  if (input.jobInfo.jobTitle || input.jobInfo.company) completed.add("job");
  if (input.educationInfo.school) completed.add("education");
  if (input.heightInfo.heightCm !== null) completed.add("height");
  if (input.lifestyleInfo.smoking || input.lifestyleInfo.drinking) completed.add("lifestyle");
  if (input.familyPlansInfo.familyPlans) completed.add("familyPlans");
  if (input.zodiacInfo.zodiacSign) completed.add("zodiac");
  if (input.languagesInfo.languages.length > 0) completed.add("languages");
  if (input.beliefsInfo.religion || input.beliefsInfo.politicalView) completed.add("beliefs");
  if (input.petsInfo.pets.length > 0) completed.add("pets");
  if (input.personalityInfo.mbtiType || input.personalityInfo.enneagramType !== null) completed.add("personality");
  if (input.interestsInfo.interests.length > 0) completed.add("interests");
  if (input.promptAnswerCount > 0) completed.add("prompts");

  const completedSections = PROFILE_COMPLETION_SECTIONS.filter((section) => completed.has(section));
  const missingSections = PROFILE_COMPLETION_SECTIONS.filter((section) => !completed.has(section));
  const percentage = Math.round((completedSections.length / PROFILE_COMPLETION_SECTIONS.length) * 100);

  return { percentage, completedSections, missingSections };
}
