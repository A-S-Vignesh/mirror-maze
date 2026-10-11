import { AudioPlayer, createAudioPlayer } from 'expo-audio';
import { voiceClips } from './voiceClips';

/**
 * Cinematic narration for cutscenes: pre-recorded voice clips (see scripts/generate-voice.ts), one per caption.
 * Each clip's real length drives how long its caption stays up and how fast its words appear, so text and voice stay in sync.
 */
let enabled = true;
let current: AudioPlayer | undefined;
const GAP_MS = 650;

export const voice = {
  configure(on: boolean) {
    enabled = on;
    if (!on) voice.stop();
  },
  /** True when this caption will be spoken aloud. */
  speaks(text: string) { return enabled && !!voiceClips[text]; },
  say(text: string) {
    const clip = voiceClips[text];
    voice.stop();
    if (!enabled || !clip) return;
    try {
      current = createAudioPlayer(clip.source);
      current.volume = 1;
      current.play();
    } catch (cause) { console.warn('Narration unavailable', cause); }
  },
  stop() {
    const p = current;
    current = undefined;
    try { p?.pause(); p?.remove(); } catch { /* the player may already be released */ }
  },
  /** How long a caption should stay up: until the narrator has finished it, or `minMs` when silent. */
  pace(text: string, minMs: number) {
    const clip = voiceClips[text];
    return enabled && clip ? Math.max(minMs * .8, clip.ms + GAP_MS) : minMs;
  },
  /** Milliseconds between revealed words so the caption finishes as the narrator does. */
  wordDelay(text: string, fallback: number) {
    const clip = voiceClips[text];
    const words = text.split(' ').length;
    return enabled && clip ? Math.max(60, (clip.ms * .92) / words) : fallback;
  },
};
