import { Progress } from '../game/progress';

export const STORAGE_KEY = 'mirror-maze:save:v1';
export const MAX_LEVEL = 135;
export interface Settings { sound: boolean; music: boolean; haptics: boolean; voice: boolean }
/** Story moments already shown: prologue, world intros, world-cleared outros, Heart forgings and the finale. */
export interface Seen { prologue: boolean; intros: number[]; outros: number[]; hearts: number[]; ending: boolean }
export interface SaveData { version: 2; progress: Progress; settings: Settings; seen: Seen; levelsSinceAd: number }
export const freshSave = (): SaveData => ({
  version: 2, progress: {}, settings: { sound: true, music: true, haptics: true, voice: true },
  seen: { prologue: false, intros: [], outros: [], hearts: [], ending: false }, levelsSinceAd: 0,
});

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
const numberList = (v: unknown) => Array.isArray(v) && v.every(n => Number.isInteger(n) && n >= 0 && n < 5) ? v as number[] : undefined;

function decodeSettings(settings: unknown) {
  if (!isObject(settings)) throw new Error('The saved settings could not be read.');
  const { sound, music, haptics } = settings;
  // Narration was added later, so older saves default to hearing it.
  const voice = settings.voice === undefined ? true : settings.voice;
  if (typeof sound !== 'boolean' || typeof music !== 'boolean' || typeof haptics !== 'boolean' || typeof voice !== 'boolean') throw new Error('The saved settings could not be read.');
  return { sound, music, haptics, voice };
}

export function decodeSave(raw: string): SaveData {
  const data: unknown = JSON.parse(raw);
  if (!isObject(data)) throw new Error('This save is damaged.');
  // Version 1 belonged to the 30-level prototype; its level layouts no longer exist, so only settings carry over.
  if (data.version === 1) return { ...freshSave(), settings: decodeSettings(data.settings) };
  if (data.version !== 2 || !isObject(data.progress) || !isObject(data.seen)) throw new Error('This save is damaged or from an unsupported version.');
  const progress: Progress = {};
  for (const [id, entry] of Object.entries(data.progress)) {
    if (!/^[1-9]\d*$/.test(id) || Number(id) > MAX_LEVEL || !isObject(entry) ||
      typeof entry.stars !== 'number' || !Number.isInteger(entry.stars) || entry.stars < 1 || entry.stars > 3 ||
      typeof entry.moves !== 'number' || !Number.isInteger(entry.moves) || entry.moves < 1) {
      throw new Error('The saved level results could not be read.');
    }
    progress[id] = { stars: entry.stars, moves: entry.moves };
  }
  const intros = numberList(data.seen.intros), outros = numberList(data.seen.outros);
  // hearts/ending were added after v2 shipped to testers, so they default when absent.
  const hearts = data.seen.hearts === undefined ? [] : numberList(data.seen.hearts);
  const ending = data.seen.ending === undefined ? false : data.seen.ending;
  if (typeof data.seen.prologue !== 'boolean' || !intros || !outros || !hearts || typeof ending !== 'boolean') throw new Error('The saved story progress could not be read.');
  const ads = data.levelsSinceAd;
  if (typeof ads !== 'number' || !Number.isInteger(ads) || ads < 0) throw new Error('The saved data could not be read.');
  return { version: 2, progress, settings: decodeSettings(data.settings), seen: { prologue: data.seen.prologue, intros, outros, hearts, ending }, levelsSinceAd: ads };
}
