import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ads, AD_INTERVAL } from '../services/ads';

test('An ad is due after every third completed level', () => {
  assert.equal(AD_INTERVAL, 3);
  assert.deepEqual([0, 1, 2, 3, 4].map(ads.isDue), [false, false, false, true, true]);
});

test('Without a provider no ad is shown and flow continues', async () => {
  ads.setProvider(undefined);
  assert.equal(await ads.show(), false);
});

test('Audio pauses during an ad and resumes even if the ad fails', async () => {
  const calls: string[] = [];
  ads.setPauseHooks({ pause: () => calls.push('pause'), resume: () => calls.push('resume') });
  ads.setProvider({ showInterstitial: async () => { calls.push('ad'); } });
  assert.equal(await ads.show(), true);
  ads.setProvider({ showInterstitial: async () => { throw new Error('no fill'); } });
  assert.equal(await ads.show(), false);
  assert.deepEqual(calls, ['pause', 'ad', 'resume', 'pause', 'resume']);
  ads.setProvider(undefined);
  ads.setPauseHooks(undefined);
});
