import { heartsEarned, Progress, worldCleared, WORLDS } from './progress';

export type AchievementKey =
  | 'firstLight' | 'flawless'
  | 'skyTemples' | 'rainforest' | 'desert' | 'iceAge' | 'theVoid'
  | 'skyHeart' | 'lifeHeart' | 'sunHeart' | 'frostHeart' | 'starHeart'
  | 'lightkeeper';

/**
 * Google Play Games achievements, in display order: what to create in Play Console (name, description, XP; the XP adds
 * up to 970 of the 2000 allowed). Each is earned from saved results alone, so a restored journey earns them again.
 */
export const ACHIEVEMENTS: { key: AchievementKey; name: string; description: string; points: number }[] = [
  { key: 'firstLight', name: 'First Light', description: 'Bend the light through your first mirror maze.', points: 10 },
  { key: 'flawless', name: 'Flawless', description: 'Earn all three crystal shards on a level.', points: 10 },
  { key: 'skyTemples', name: 'The Fallen Sky', description: 'Restore the Sky Temples: clear all 18 levels of Chapter 1.', points: 30 },
  { key: 'skyHeart', name: 'Sky Heart', description: 'Forge the Sky Heart: earn all three shards on every level of Chapter 1.', points: 60 },
  { key: 'rainforest', name: 'The Storm Canopy', description: 'Restore the Emerald Rainforest: clear all 18 levels of Chapter 2.', points: 45 },
  { key: 'lifeHeart', name: 'Life Heart', description: 'Forge the Life Heart: earn all three shards on every level of Chapter 2.', points: 75 },
  { key: 'desert', name: 'The Sinking Sun', description: 'Restore the Desert of Pyramids: clear all 18 levels of Chapter 3.', points: 60 },
  { key: 'sunHeart', name: 'Sun Heart', description: 'Forge the Sun Heart: earn all three shards on every level of Chapter 3.', points: 90 },
  { key: 'iceAge', name: 'The Frozen Echo', description: 'Restore the Ice Age: clear all 18 levels of Chapter 4.', points: 75 },
  { key: 'frostHeart', name: 'Frost Heart', description: 'Forge the Frost Heart: earn all three shards on every level of Chapter 4.', points: 105 },
  { key: 'theVoid', name: 'Heart of the Void', description: 'Cross the Void: clear all 18 levels of Chapter 5.', points: 90 },
  { key: 'starHeart', name: 'Star Heart', description: 'Forge the Star Heart: earn all three shards on every level of Chapter 5.', points: 120 },
  { key: 'lightkeeper', name: 'The Last Lightkeeper', description: 'Forge all five Hearts and seal the Void.', points: 200 },
];

const worldKeys: AchievementKey[] = ['skyTemples', 'rainforest', 'desert', 'iceAge', 'theVoid'];
const heartKeys: AchievementKey[] = ['skyHeart', 'lifeHeart', 'sunHeart', 'frostHeart', 'starHeart'];

export function earnedAchievements(progress: Progress): AchievementKey[] {
  const earned: AchievementKey[] = [];
  if (progress['1']) earned.push('firstLight');
  if (Object.values(progress).some(result => result.stars === 3)) earned.push('flawless');
  const hearts = heartsEarned(progress);
  for (let w = 0; w < WORLDS; w++) {
    if (worldCleared(progress, w)) earned.push(worldKeys[w]!);
    if (hearts.includes(w)) earned.push(heartKeys[w]!);
  }
  if (hearts.length === WORLDS) earned.push('lightkeeper');
  return earned;
}
