import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, earnedAchievements } from './achievements';
import { ACHIEVEMENT_IDS } from '../config/googlePlay';
import { LEVELS_PER_WORLD, Progress } from './progress';
import { cloudProgress, decodeCloud, encodeCloud, freshSave, mergeSaves, sameJourney, SaveData } from '../services/storage';

const cleared = (from: number, to: number, stars = 3): Progress =>
  Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [String(from + i), { stars, moves: 5 }]));
const journey = (progress: Progress, seen: Partial<SaveData['seen']> = {}): SaveData =>
  ({ ...freshSave(), progress, seen: { ...freshSave().seen, ...seen } });

test('Achievements fit Play Console limits and every one has a config slot', () => {
  const points = ACHIEVEMENTS.reduce((sum, a) => sum + a.points, 0);
  assert.ok(ACHIEVEMENTS.length >= 5, 'Play Games needs at least five achievements to publish');
  assert.ok(points <= 2000);
  for (const a of ACHIEVEMENTS) {
    assert.ok(a.points % 5 === 0 && a.points <= 200, a.key);
    assert.ok(a.name.length <= 100 && a.description.length <= 500, a.key);
  }
  assert.deepEqual(ACHIEVEMENTS.map(a => a.key).sort(), Object.keys(ACHIEVEMENT_IDS).sort());
  const ids = Object.values(ACHIEVEMENT_IDS).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length, 'an achievement id is used twice');
});

test('Achievements are earned from saved results', () => {
  assert.deepEqual(earnedAchievements({}), []);
  assert.deepEqual(earnedAchievements(cleared(1, 1, 2)), ['firstLight']);
  assert.deepEqual(earnedAchievements(cleared(1, 1)), ['firstLight', 'flawless']);
  // Clearing a world (its last level) restores it; all 54 shards forge its Heart.
  assert.deepEqual(earnedAchievements(cleared(1, LEVELS_PER_WORLD, 1)), ['firstLight', 'skyTemples']);
  assert.deepEqual(earnedAchievements(cleared(1, LEVELS_PER_WORLD)), ['firstLight', 'flawless', 'skyTemples', 'skyHeart']);
  // Each world's Heart counts on its own, whatever happened in the others.
  assert.deepEqual(earnedAchievements({ ...cleared(1, LEVELS_PER_WORLD, 1), ...cleared(LEVELS_PER_WORLD + 1, 2 * LEVELS_PER_WORLD) }),
    ['firstLight', 'flawless', 'skyTemples', 'rainforest', 'lifeHeart']);
  assert.deepEqual(earnedAchievements(cleared(1, 5 * LEVELS_PER_WORLD)), ACHIEVEMENTS.map(a => a.key));
});

test('The cloud save round-trips and rejects damaged or unknown data', () => {
  const save = journey(cleared(1, 4), { prologue: true, intros: [1, 0], hearts: [] });
  const back = decodeCloud(encodeCloud(save));
  assert.ok(sameJourney(back, save));
  assert.deepEqual(back.seen.intros, [0, 1]);
  assert.throws(() => decodeCloud('{"version":4,"progress":{},"seen":{}}'));
  assert.throws(() => decodeCloud('{"version":3,"progress":{"1":{"stars":9,"moves":1}},"seen":{"prologue":true,"intros":[],"outros":[]}}'));
  assert.throws(() => decodeCloud('not json'));
});

test('Merging keeps the best of both journeys and only the local device settings', () => {
  const local: SaveData = { ...journey({ 1: { stars: 3, moves: 4 }, 2: { stars: 1, moves: 9 } }, { prologue: true, intros: [0] }), levelsSinceAd: 2 };
  local.settings.music = false;
  const cloud = journey({ 2: { stars: 2, moves: 7 }, 3: { stars: 1, moves: 8 } }, { intros: [1, 0], hearts: [0], ending: false });
  const merged = mergeSaves(local, cloud);
  assert.deepEqual(merged.progress, { 1: { stars: 3, moves: 4 }, 2: { stars: 2, moves: 7 }, 3: { stars: 1, moves: 8 } });
  assert.deepEqual(merged.seen, { prologue: true, intros: [0, 1], outros: [], hearts: [0], ending: false });
  assert.equal(merged.settings.music, false);
  assert.equal(merged.levelsSinceAd, 2);
  // Merging again changes nothing, so a synced journey is not written back and forth.
  assert.ok(sameJourney(mergeSaves(merged, cloud), merged));
  assert.ok(sameJourney(mergeSaves(merged, merged), merged));
});

test('Cloud progress never decreases as a journey grows', () => {
  const a = journey(cleared(1, 10, 1)), b = mergeSaves(a, journey(cleared(1, 10, 3))), c = mergeSaves(b, journey(cleared(11, 11, 1)));
  assert.ok(cloudProgress(a) < cloudProgress(b));
  assert.ok(cloudProgress(b) < cloudProgress(c));
  assert.equal(cloudProgress(freshSave()), 0);
});
