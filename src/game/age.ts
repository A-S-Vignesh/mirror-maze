/**
 * The first-launch age screen asks for a year of birth. Its answer sets the ads (Google Play Families policy) and
 * decides whether Google Play Games may start. The year stays on the device (services/useAge.ts).
 */
export type AgeGroup = 'child' | 'teen' | 'adult';

/** Below this age a player is a child (COPPA): child-directed ads, and no Google Play Games, whose sign-in uses OAuth. */
export const CHILD_UNDER = 13;
/** Below this age ads are never personalised and stay rated for all ages. */
export const ADULT_FROM = 18;
/** How many years back the age screen offers. */
export const OLDEST_AGE = 100;

/**
 * The group for the youngest age the player can be. A birth year alone cannot tell whether this year's birthday has
 * passed, so a year on a boundary always counts as the younger group.
 */
export function ageGroup(birthYear: number, now = new Date()): AgeGroup {
  const youngest = now.getFullYear() - birthYear - 1;
  return youngest < CHILD_UNDER ? 'child' : youngest < ADULT_FROM ? 'teen' : 'adult';
}

/** The years the age screen offers, newest first. */
export function birthYears(now = new Date()): number[] {
  const year = now.getFullYear();
  return Array.from({ length: OLDEST_AGE + 1 }, (_, i) => year - i);
}

/** Whether a stored value is a year the age screen could have offered; anything else means asking again. */
export function validBirthYear(value: unknown, now = new Date()): value is number {
  const year = now.getFullYear();
  return typeof value === 'number' && Number.isInteger(value) && value <= year && value >= year - OLDEST_AGE;
}

/**
 * Google AdMob settings per group. Children get child-directed requests (no advertising ID, no personalised ads or
 * remarketing). Teens are marked under the age of consent (no advertising ID, no personalised ads). Everyone under 18
 * sees only ads rated for all ages; adults see ads up to PG and are asked for consent where the law requires it.
 * The two tags are never both set: Google gives the child-directed one precedence anyway.
 */
export function adSettings(group: AgeGroup) {
  return {
    childDirected: group === 'child',
    underAgeOfConsent: group === 'teen',
    /** Google's consent form (EEA/UK/CH) is skipped for anyone who cannot give consent. */
    consentFormUnderAge: group !== 'adult',
    maxRating: group === 'adult' ? 'PG' : 'G',
  } as const;
}

/** Google Play Games sign-in is not approved for child-directed services, so children play without it. */
export const playGamesAllowed = (group: AgeGroup) => group !== 'child';
