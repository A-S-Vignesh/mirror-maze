/**
 * Interstitial ad integration point. The business model shows one ad after every third completed level,
 * at a natural break (when the player taps Continue), never during story cinematics or gameplay.
 *
 * Register a real network (e.g. react-native-google-mobile-ads in a development build) with `ads.setProvider`.
 * Without a provider this is a no-op, so the game never shows fake or placeholder ads.
 */
export interface AdProvider { showInterstitial(): Promise<void> }

let provider: AdProvider | undefined;
let pauseHooks: { pause: () => void; resume: () => void } | undefined;
export const AD_INTERVAL = 3;

export const ads = {
  setProvider(next: AdProvider | undefined) { provider = next; },
  /** Lets the app silence music and haptics while an ad is on screen. */
  setPauseHooks(hooks: typeof pauseHooks) { pauseHooks = hooks; },
  isDue(levelsSinceAd: number) { return levelsSinceAd >= AD_INTERVAL; },
  /** Resolves once the ad has closed or failed; game flow always continues. */
  async show(): Promise<boolean> {
    if (!provider) return false;
    pauseHooks?.pause();
    try { await provider.showInterstitial(); return true; }
    catch (cause) { console.warn('Interstitial failed', cause); return false; }
    finally { pauseHooks?.resume(); }
  },
};
