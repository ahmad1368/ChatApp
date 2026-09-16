"use client";

import { useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../../guestIdentity";
import BioEditor from "../../BioEditor";
import WeeklyGoalEditor from "../../WeeklyGoalEditor";
import IntroVideoUpload from "../../IntroVideoUpload";
import VoiceIntroRecorder from "../../VoiceIntroRecorder";
import BackgroundMusicUploader from "../../BackgroundMusicUploader";
import ProfilePromptsEditor from "../../ProfilePromptsEditor";
import JobInfoEditor from "../../JobInfoEditor";
import EducationInfoEditor from "../../EducationInfoEditor";
import VoiceResumeRecorder from "../../VoiceResumeRecorder";
import HeightInfoEditor from "../../HeightInfoEditor";
import AgeInfoEditor from "../../AgeInfoEditor";
import MessageAgeLimitEditor from "../../MessageAgeLimitEditor";
import LifestyleInfoEditor from "../../LifestyleInfoEditor";
import FamilyPlansInfoEditor from "../../FamilyPlansInfoEditor";
import MaritalStatusInfoEditor from "../../MaritalStatusInfoEditor";
import ZodiacInfoEditor from "../../ZodiacInfoEditor";
import LanguagesInfoEditor from "../../LanguagesInfoEditor";
import BeliefsInfoEditor from "../../BeliefsInfoEditor";
import PetsInfoEditor from "../../PetsInfoEditor";
import DietInfoEditor from "../../DietInfoEditor";
import BloodTypeInfoEditor from "../../BloodTypeInfoEditor";
import PersonalityInfoEditor from "../../PersonalityInfoEditor";
import SpotifyConnect from "../../SpotifyConnect";
import FacebookConnect from "../../FacebookConnect";
import InstagramConnect from "../../InstagramConnect";
import InterestsInfoEditor from "../../InterestsInfoEditor";
import WeekendPlansEditor from "../../WeekendPlansEditor";
import ProfileVisibilityEditor from "../../ProfileVisibilityEditor";
import VanishModeEditor from "../../VanishModeEditor";
import SuperLikeOptOutEditor from "../../SuperLikeOptOutEditor";
import SnoozeAccountEditor from "../../SnoozeAccountEditor";
import SocialLinksEditor from "../../SocialLinksEditor";
import TravelModeEditor from "../../TravelModeEditor";
import PassportModeEditor from "../../PassportModeEditor";
import ProfileColorThemeEditor from "../../ProfileColorThemeEditor";
import GenderInfoEditor from "../../GenderInfoEditor";
import AchievementsInfoEditor from "../../AchievementsInfoEditor";
import DisplayNameModeEditor from "../../DisplayNameModeEditor";
import StylizedAvatarEditor from "../../StylizedAvatarEditor";
import AiAvatarEditor from "../../AiAvatarEditor";
import DiscoveryFiltersEditor from "../../DiscoveryFiltersEditor";
import KeywordBlacklistEditor from "../../KeywordBlacklistEditor";
import ProfileCompletion from "../../ProfileCompletion";
import ProfilePreview from "../../ProfilePreview";
import SmartScoreDisplay from "../../SmartScoreDisplay";
import ActivityLevelDisplay from "../../ActivityLevelDisplay";

/**
 * "Quickly edit and update details from settings" (#90) — a single place to
 * reach every standalone profile field this app tracks (#61-#89), instead
 * of scrolling through them inline at the bottom of the chat screen where
 * they lived before. Doesn't include the photo album section: that's
 * deeply wired into ChatRoom's own state/handlers (drag-and-drop reorder,
 * access-level requests) rather than a standalone `author`-prop component
 * like the fields below, so moving it is a separate, riskier refactor.
 */
export default function ProfileSettingsPage() {
  const [author] = useState(() => getOrCreateGuestIdentity());

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1>Edit profile</h1>
      <p>
        <Link href="/">&larr; Back to chat</Link>
      </p>
      <ProfileCompletion author={author} />
      <BioEditor author={author} />
      <WeeklyGoalEditor author={author} />
      <IntroVideoUpload author={author} />
      <VoiceIntroRecorder author={author} />
      <BackgroundMusicUploader author={author} />
      <ProfilePromptsEditor author={author} />
      <JobInfoEditor author={author} />
      <EducationInfoEditor author={author} />
      <VoiceResumeRecorder author={author} />
      <HeightInfoEditor author={author} />
      <AgeInfoEditor author={author} />
      <MessageAgeLimitEditor author={author} />
      <LifestyleInfoEditor author={author} />
      <FamilyPlansInfoEditor author={author} />
      <MaritalStatusInfoEditor author={author} />
      <ZodiacInfoEditor author={author} />
      <LanguagesInfoEditor author={author} />
      <BeliefsInfoEditor author={author} />
      <PetsInfoEditor author={author} />
      <DietInfoEditor author={author} />
      <BloodTypeInfoEditor author={author} />
      <PersonalityInfoEditor author={author} />
      <SpotifyConnect author={author} />
      <FacebookConnect author={author} />
      <InstagramConnect author={author} />
      <InterestsInfoEditor author={author} />
      <WeekendPlansEditor author={author} />
      <SocialLinksEditor author={author} />
      <TravelModeEditor author={author} />
      <PassportModeEditor author={author} />
      <ProfileColorThemeEditor author={author} />
      <GenderInfoEditor author={author} />
      <AchievementsInfoEditor author={author} />
      <DisplayNameModeEditor author={author} />
      <StylizedAvatarEditor author={author} />
      <AiAvatarEditor author={author} />
      <ProfileVisibilityEditor author={author} />
      <VanishModeEditor author={author} />
      <SuperLikeOptOutEditor author={author} />
      <SnoozeAccountEditor author={author} />
      <DiscoveryFiltersEditor author={author} />
      <KeywordBlacklistEditor author={author} />
      <ProfilePreview author={author} />
      <SmartScoreDisplay author={author} />
      <ActivityLevelDisplay author={author} />
    </main>
  );
}
