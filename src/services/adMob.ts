import type { AgeGroup } from '../game/age';

/** Web builds have no ad SDK: the ad slot stays empty (see ads.ts). Phones use adMob.native.ts. */
export function startAds(_group: AgeGroup) {}

export const adPrivacy = {
  async required() { return false; },
  async show() {},
};
