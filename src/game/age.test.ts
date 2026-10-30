import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adSettings, ageGroup, birthYears, OLDEST_AGE, playGamesAllowed, validBirthYear } from './age';

const now = new Date(2026, 9, 28);

test('A birth year counts as the youngest age it could mean', () => {
  // Born 2013: 12 or 13 in 2026, so still a child. Born 2012: at least 13.
  assert.equal(ageGroup(2013, now), 'child');
  assert.equal(ageGroup(2012, now), 'teen');
  // Born 2008: 17 or 18, so still a teen. Born 2007: at least 18.
  assert.equal(ageGroup(2008, now), 'teen');
  assert.equal(ageGroup(2007, now), 'adult');
  assert.equal(ageGroup(2026, now), 'child');
  assert.equal(ageGroup(1926, now), 'adult');
});

test('The age screen offers this year back to the oldest age, newest first', () => {
  const years = birthYears(now);
  assert.equal(years.length, OLDEST_AGE + 1);
  assert.equal(years[0], 2026);
  assert.equal(years.at(-1), 2026 - OLDEST_AGE);
  for (const year of years) assert.ok(validBirthYear(year, now));
});

test('Only years the screen could offer are accepted from storage', () => {
  for (const bad of [Number.NaN, 0, 2027, 1925, 2010.5, '2010', null, undefined]) assert.equal(validBirthYear(bad, now), false, String(bad));
});

test('Ads and Play Games follow the age group', () => {
  assert.deepEqual(adSettings('child'), { childDirected: true, underAgeOfConsent: false, consentFormUnderAge: true, maxRating: 'G' });
  assert.deepEqual(adSettings('teen'), { childDirected: false, underAgeOfConsent: true, consentFormUnderAge: true, maxRating: 'G' });
  assert.deepEqual(adSettings('adult'), { childDirected: false, underAgeOfConsent: false, consentFormUnderAge: false, maxRating: 'PG' });
  assert.equal(playGamesAllowed('child'), false);
  assert.equal(playGamesAllowed('teen'), true);
  assert.equal(playGamesAllowed('adult'), true);
});
