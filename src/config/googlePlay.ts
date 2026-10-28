import type { AchievementKey } from '../game/achievements';

/**
 * Store identifiers, filled in from the AdMob and Play Console dashboards (docs/GOOGLE_PLAY.md walks through each one).
 * The app ids are native settings and live in app.json instead: the AdMob app id in the react-native-google-mobile-ads
 * plugin, the Play Games project id in the google-play plugin.
 *
 * Until a value is filled in: ads use Google's test ad unit, and the matching achievement or leaderboard is skipped.
 */

/** AdMob interstitial ad unit ids ("ca-app-pub-…/…"). Development builds always use Google's test unit. */
export const INTERSTITIAL_UNIT: { android: string; ios: string } = { android: '', ios: '' };

/** The Remove Ads in-app product (Play Console > Monetize > In-app products). A one-time, non-consumable purchase. */
export const REMOVE_ADS_PRODUCT = 'remove_ads';

/** Play Games achievement ids ("CgkI…"), from Play Console > Play Games Services > Achievements. */
export const ACHIEVEMENT_IDS: Record<AchievementKey, string> = {
  firstLight: 'CgkItYzP0esTEAIQAQ',
  flawless: 'CgkItYzP0esTEAIQAw',
  skyTemples: 'CgkItYzP0esTEAIQAg',
  skyHeart: 'CgkItYzP0esTEAIQBA',
  rainforest: 'CgkItYzP0esTEAIQBQ',
  lifeHeart: 'CgkItYzP0esTEAIQBg',
  desert: 'CgkItYzP0esTEAIQBw',
  sunHeart: 'CgkItYzP0esTEAIQCA',
  iceAge: 'CgkItYzP0esTEAIQCQ',
  frostHeart: 'CgkItYzP0esTEAIQCg',
  theVoid: 'CgkItYzP0esTEAIQCw',
  starHeart: 'CgkItYzP0esTEAIQDQ',
  lightkeeper: 'CgkItYzP0esTEAIQDA',
};

/**
 * A "Crystal Shards" leaderboard id ("CgkI…"): total shards, higher is better. Empty on purpose: shards stop at 270, so
 * every finisher would tie. While empty, the Ranks orb is hidden and no scores are sent.
 */
export const SHARDS_LEADERBOARD = '';

/**
 * The privacy policy ("https://…"): the same address as in Play Console > App content > Privacy policy. Google Play
 * requires a link inside the app too; Settings shows one under the version line once this is filled in.
 */
export const PRIVACY_POLICY_URL: string = '';
