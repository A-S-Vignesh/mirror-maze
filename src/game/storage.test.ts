import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completedDevelopmentSave, decodeSave, freshSave, MAX_LEVEL } from '../services/storage';

test('Development save completes every level and story moment', () => {
  const save = completedDevelopmentSave(freshSave());
  assert.equal(Object.keys(save.progress).length, MAX_LEVEL);
  assert.deepEqual(save.progress['1'], { stars: 3, moves: 1 });
  assert.deepEqual(save.progress[String(MAX_LEVEL)], { stars: 3, moves: 1 });
  assert.deepEqual(save.seen, { prologue: true, intros: [0, 1, 2, 3, 4], outros: [0, 1, 2, 3, 4], hearts: [0, 1, 2, 3, 4], ending: true });
});

test('Progress, settings and story flags survive serialization', () => {
  const save = { ...freshSave(), progress: { 135: { stars: 3, moves: 7 } }, seen: { prologue: true, intros: [0, 1], outros: [0], hearts: [0], ending: false }, levelsSinceAd: 2 };
  assert.deepEqual(decodeSave(JSON.stringify(save)), save);
});
test('Earlier v2 saves without Heart flags still load', () => {
  const old = { ...freshSave(), seen: { prologue: true, intros: [0], outros: [] } };
  assert.deepEqual(decodeSave(JSON.stringify(old)).seen, { prologue: true, intros: [0], outros: [], hearts: [], ending: false });
});
test('Prototype v1 saves keep settings only', () => {
  const v1 = { version: 1, progress: { 1: { stars: 3, moves: 1 } }, settings: { sound: false, music: true, haptics: false } };
  const decoded = decodeSave(JSON.stringify(v1));
  assert.deepEqual(decoded.progress, {});
  assert.equal(decoded.settings.sound, false);
});
test('Corrupt and invalid saves are rejected explicitly', () => {
  for (const raw of ['{', '{}', '{"version":3}', JSON.stringify({ ...freshSave(), progress: { 136: { stars: 3, moves: 1 } } }),
    JSON.stringify({ ...freshSave(), seen: { prologue: 'yes', intros: [], outros: [] } }),
    JSON.stringify({ ...freshSave(), seen: { prologue: true, intros: [], outros: [], hearts: [9], ending: false } }),
    JSON.stringify({ ...freshSave(), settings: { music: 'yes' } })]) {
    assert.throws(() => decodeSave(raw));
  }
});
test('Saves from before narration existed default to narration on', () => {
  const old = { ...freshSave(), settings: { sound: true, music: false, haptics: true } };
  assert.deepEqual(decodeSave(JSON.stringify(old)).settings, { sound: true, music: false, haptics: true, voice: true });
  assert.throws(() => decodeSave(JSON.stringify({ ...freshSave(), settings: { sound: true, music: true, haptics: true, voice: 'loud' } })));
});
