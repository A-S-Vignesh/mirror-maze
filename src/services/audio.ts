import { Platform } from 'react-native';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';

const sources = {
  pop: require('../../assets/audio/pop.mp3'),
  whoosh: require('../../assets/audio/whoosh.mp3'),
  bonk: require('../../assets/audio/bonk.mp3'),
  type: require('../../assets/audio/type.mp3'),
  tick: require('../../assets/audio/tick.mp3'),
  rotate0: require('../../assets/audio/rotate0.mp3'),
  rotate1: require('../../assets/audio/rotate1.mp3'),
  rotate2: require('../../assets/audio/rotate2.mp3'),
  rotate3: require('../../assets/audio/rotate3.mp3'),
  rotate4: require('../../assets/audio/rotate4.mp3'),
  zap: require('../../assets/audio/zap.mp3'),
  sizzle: require('../../assets/audio/sizzle.mp3'),
  crystal: require('../../assets/audio/crystal.mp3'),
  split: require('../../assets/audio/split.mp3'),
  portal: require('../../assets/audio/portal.mp3'),
  turn: require('../../assets/audio/turn.mp3'),
  curse: require('../../assets/audio/curse.mp3'),
  thaw: require('../../assets/audio/thaw.mp3'),
  thunder1: require('../../assets/audio/thunder1.mp3'),
  thunder2: require('../../assets/audio/thunder2.mp3'),
  star1: require('../../assets/audio/star1.mp3'),
  star2: require('../../assets/audio/star2.mp3'),
  star3: require('../../assets/audio/star3.mp3'),
  win: require('../../assets/audio/win.mp3'),
  charge: require('../../assets/audio/charge.mp3'),
  fail: require('../../assets/audio/fail.mp3'),
  heart: require('../../assets/audio/heart.mp3'),
  riser: require('../../assets/audio/riser.mp3'),
  boom: require('../../assets/audio/boom.mp3'),
};
const music = [
  require('../../assets/audio/music0.mp3'), require('../../assets/audio/music1.mp3'), require('../../assets/audio/music2.mp3'),
  require('../../assets/audio/music3.mp3'), require('../../assets/audio/music4.mp3'),
];
const ambience = [
  require('../../assets/audio/amb0.mp3'), require('../../assets/audio/amb1.mp3'), require('../../assets/audio/amb2.mp3'),
  require('../../assets/audio/amb3.mp3'), require('../../assets/audio/amb4.mp3'),
];
export type Sfx = keyof typeof sources | 'rotate';
const volumes: Partial<Record<keyof typeof sources, number>> = { pop: .45, whoosh: .3, zap: .22, type: .25, sizzle: .2, tick: .45, thunder1: .6, thunder2: .45, rotate0: .7, rotate1: .7, rotate2: .7, rotate3: .7, rotate4: .7, charge: .7, crystal: .55 };

const players: Partial<Record<keyof typeof sources, AudioPlayer>> = {};
let musicPlayer: AudioPlayer | undefined;
let ambPlayer: AudioPlayer | undefined;
let loaded = -1;
let chapter = 0;
let options = { sound: true, music: true, haptics: true };
let active = true;
let duck = 1;
let unlocked = Platform.OS !== 'web';
let failureListener: ((message: string) => void) | undefined;

function fail(cause: unknown) {
  console.warn('Optional audio unavailable', cause);
  failureListener?.('Some sounds are unavailable on this device. The game still works.');
}
function loop(source: number, volume: number) {
  const p = createAudioPlayer(source);
  p.loop = true;
  p.volume = volume;
  return p;
}
function sync() {
  try {
    const on = active && unlocked;
    if (loaded !== chapter) {
      musicPlayer?.remove(); ambPlayer?.remove();
      musicPlayer = ambPlayer = undefined;
      loaded = chapter;
    }
    if (on && options.music) {
      musicPlayer ??= loop(music[chapter], .3);
      musicPlayer.volume = .3 * duck;
      if (!musicPlayer.playing) musicPlayer.play();
    } else musicPlayer?.pause();
    if (on && options.sound) {
      ambPlayer ??= loop(ambience[chapter], chapter === 1 ? .3 : .24);
      if (!ambPlayer.playing) ambPlayer.play();
    } else ambPlayer?.pause();
  } catch (cause) { fail(cause); }
}

export const audio = {
  init() { void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => undefined); },
  onFailure(listener: (message: string) => void) { failureListener = listener; },
  configure(next: typeof options, isActive: boolean) { options = next; active = isActive; sync(); },
  setChapter(next: number) { if (next !== chapter) { chapter = next; sync(); } },
  /** Lowers the music under cinematic stingers. */
  setDuck(level: number) { duck = level; if (musicPlayer) musicPlayer.volume = .3 * duck; },
  unlock() { if (!unlocked) { unlocked = true; sync(); } },
  play(name: Sfx, volume = 1) {
    if (name === 'pop' || name === 'rotate' || name === 'whoosh') audio.unlock();
    if (!options.sound || !unlocked) return;
    const key = (name === 'rotate' ? `rotate${chapter}` : name) as keyof typeof sources;
    try {
      const p = (players[key] ??= createAudioPlayer(sources[key]));
      p.volume = (volumes[key] ?? 1) * volume;
      void p.seekTo(0).then(() => p.play()).catch(fail);
    } catch (cause) { fail(cause); }
  },
  haptic(kind: 'tap' | 'success' | 'error' | 'heavy' = 'tap') {
    if (!options.haptics || Platform.OS === 'web') return;
    const run = kind === 'success' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : kind === 'error' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      : kind === 'heavy' ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void run.catch(() => undefined);
  },
  dispose() {
    Object.values(players).forEach(p => p?.remove());
    [musicPlayer, ambPlayer].forEach(p => p?.remove());
    musicPlayer = ambPlayer = undefined;
    loaded = -1;
  },
};
