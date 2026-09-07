"use client";

import { useState } from "react";
import Link from "next/link";
import { getOrCreateGuestIdentity } from "../../guestIdentity";
import BioEditor from "../../BioEditor";
import IntroVideoUpload from "../../IntroVideoUpload";
import VoiceIntroRecorder from "../../VoiceIntroRecorder";
import ProfilePromptsEditor from "../../ProfilePromptsEditor";
import JobInfoEditor from "../../JobInfoEditor";
import EducationInfoEditor from "../../EducationInfoEditor";
import HeightInfoEditor from "../../HeightInfoEditor";
import LifestyleInfoEditor from "../../LifestyleInfoEditor";
import FamilyPlansInfoEditor from "../../FamilyPlansInfoEditor";
import ZodiacInfoEditor from "../../ZodiacInfoEditor";
import LanguagesInfoEditor from "../../LanguagesInfoEditor";
import BeliefsInfoEditor from "../../BeliefsInfoEditor";
import PetsInfoEditor from "../../PetsInfoEditor";
import PersonalityInfoEditor from "../../PersonalityInfoEditor";
import SpotifyConnect from "../../SpotifyConnect";
import InstagramConnect from "../../InstagramConnect";
import InterestsInfoEditor from "../../InterestsInfoEditor";
import ProfileVisibilityEditor from "../../ProfileVisibilityEditor";
import SocialLinksEditor from "../../SocialLinksEditor";
import TravelModeEditor from "../../TravelModeEditor";
import PassportModeEditor from "../../PassportModeEditor";
import ProfileColorThemeEditor from "../../ProfileColorThemeEditor";
import AchievementsInfoEditor from "../../AchievementsInfoEditor";
import DisplayNameModeEditor from "../../DisplayNameModeEditor";
import StylizedAvatarEditor from "../../StylizedAvatarEditor";
import DiscoveryFiltersEditor from "../../DiscoveryFiltersEditor";
import ProfileCompletion from "../../ProfileCompletion";
import ProfilePreview from "../../ProfilePreview";
import SmartScoreDisplay from "../../SmartScoreDisplay";

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
      <IntroVideoUpload author={author} />
      <VoiceIntroRecorder author={author} />
      <ProfilePromptsEditor author={author} />
      <JobInfoEditor author={author} />
      <EducationInfoEditor author={author} />
      <HeightInfoEditor author={author} />
      <LifestyleInfoEditor author={author} />
      <FamilyPlansInfoEditor author={author} />
      <ZodiacInfoEditor author={author} />
      <LanguagesInfoEditor author={author} />
      <BeliefsInfoEditor author={author} />
      <PetsInfoEditor author={author} />
      <PersonalityInfoEditor author={author} />
      <SpotifyConnect author={author} />
      <InstagramConnect author={author} />
      <InterestsInfoEditor author={author} />
      <SocialLinksEditor author={author} />
      <TravelModeEditor author={author} />
      <PassportModeEditor author={author} />
      <ProfileColorThemeEditor author={author} />
      <AchievementsInfoEditor author={author} />
      <DisplayNameModeEditor author={author} />
      <StylizedAvatarEditor author={author} />
      <ProfileVisibilityEditor author={author} />
      <DiscoveryFiltersEditor author={author} />
      <ProfilePreview author={author} />
      <SmartScoreDisplay author={author} />
    </main>
  );
}
