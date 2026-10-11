import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMove, canRotate, clipToCrystals, greedyPlay, initialState, solve, starsFor, tappables, traceBeam, traceState, validateLevel } from './engine';
import { levels } from './levels';
import { chapters, mechanicTips } from './chapters';
import { heartsEarned, recordResult, totalStars, unlockedLevel, worldCleared, worldShards } from './progress';
import { Level } from './types';

const base = (over: Partial<Level>): Level => ({
  id: 1, chapter: 0, index: 1, title: 't', beat: 'b', size: 5, emitters: [{ id: 'e1', position: [0, 2], direction: 'E' }], hazards: [], solutionAims: {}, maxMoves: 9,
  mirrors: [], targets: [], blockers: [], portals: [], splitters: [], solution: {}, par: 1, twoStar: 3, boss: false, mechanics: [], ...over,
});

test('135 levels, 27 per chapter, each with a title and story beat', () => {
  assert.equal(levels.length, 135);
  for (const c of chapters) assert.equal(c.levels.length, 27);
  for (const l of levels) assert.ok(l.title && l.beat);
});

for (const level of levels) {
  test(`Level ${level.id} (${chapters[level.chapter]!.world} ${level.index}) is valid and par is optimal`, () => {
    assert.deepEqual(validateLevel(level), []);
  });
}

test('Difficulty never decreases sharply and chapters introduce their modifiers', () => {
  const avg = (c: number) => levels.filter(l => l.chapter === c).reduce((s, l) => s + l.par, 0) / 27;
  for (let c = 1; c < 5; c++) assert.ok(avg(c) >= avg(c - 1) - .35, `chapter ${c + 1} easier than ${c}`);
  const has = (c: number, m: string) => levels.some(l => l.chapter === c && l.mechanics.includes(m as never));
  assert.ok(has(0, 'twin') && has(1, 'link') && has(1, 'turn') && has(2, 'splitter') && has(2, 'hazard') && has(3, 'frozen') && has(3, 'triple') && has(4, 'portal'));
  assert.ok(levels.every(l => l.mechanics.includes('limit') && l.maxMoves > l.twoStar));
  for (const l of levels) for (const m of l.mechanics) assert.ok(m in mechanicTips);
});

test('Splitters fork the beam into both perpendicular directions', () => {
  const level = base({ splitters: [{ id: 's1', position: [2, 2] }], targets: [{ id: 'a', position: [2, 0] }, { id: 'b', position: [2, 4] }] });
  const trace = traceBeam(level, {});
  assert.equal(trace.won, true);
  assert.equal(trace.activatedAt.a, trace.activatedAt.b);
});

test('Solved beams are clipped to end inside the last crystal of every branch', () => {
  const single = base({ targets: [{ id: 'a', position: [3, 2] }] });
  const clipped = clipToCrystals(traceBeam(single, {}));
  assert.equal(clipped.segments.length, 1);
  assert.deepEqual(clipped.segments[0]!.to, [3, 2]);
  assert.equal(clipped.segments[0]!.exit, false);
  const split = base({ splitters: [{ id: 's1', position: [2, 2] }], targets: [{ id: 'a', position: [2, 1] }, { id: 'b', position: [2, 4] }] });
  const ends = clipToCrystals(traceBeam(split, {})).segments.map(s => s.to.join(',')).sort();
  assert.deepEqual(ends, ['2,1', '2,2', '2,4']);
  for (const l of levels) {
    const t = traceBeam(l, l.solution);
    const c = clipToCrystals(t);
    assert.ok(c.segments.every(s => !s.exit && !s.blocked), `level ${l.id} has a stray beam`);
    assert.deepEqual(c.activatedAt, t.activatedAt);
  }
});

test('Portals carry light to their exit without changing direction', () => {
  const level = base({ portals: [{ id: 'p', position: [1, 2], exit: [1, 4] }], targets: [{ id: 'a', position: [3, 4] }] });
  assert.equal(traceBeam(level, {}).won, true);
});

test('Blocked and exiting beams end at faces / board edge', () => {
  const blocked = traceBeam(base({ blockers: [[3, 2]], targets: [{ id: 'a', position: [4, 4] }] }), {});
  assert.equal(blocked.segments.at(-1)!.blocked, true);
  assert.ok(Math.abs(blocked.segments.at(-1)!.to[0] - 2.54) < 1e-9);
  const exit = traceBeam(base({ targets: [{ id: 'a', position: [4, 4] }] }), {});
  assert.equal(exit.segments.at(-1)!.exit, true);
});

test('Linked mirrors rotate together; frozen mirrors only after thawing', () => {
  const level = base({
    mirrors: [
      { id: 'a', position: [2, 2], orientation: 1, fixed: false, link: 'v' },
      { id: 'b', position: [4, 0], orientation: 1, fixed: false, link: 'v' },
      { id: 'f', position: [1, 0], orientation: 0, fixed: false, frozen: true },
    ],
    targets: [{ id: 'c', position: [2, 0] }],
  });
  let s = initialState(level);
  assert.equal(canRotate(level, s, 'f'), false);
  s = applyMove(level, s, 'a');
  assert.equal(s.orientations.a, 0);
  assert.equal(s.orientations.b, 0);
  assert.deepEqual(solve(level, initialState(level)), ['a']);
});

test('Loops terminate', () => {
  const level = base({ portals: [{ id: 'p', position: [1, 2], exit: [0, 2] }], targets: [{ id: 'a', position: [4, 4] }] });
  const trace = traceBeam(level, {});
  assert.equal(trace.loop, true);
});

test('Stars and idempotent best results', () => {
  const l = levels[10]!;
  assert.equal(starsFor(l, l.par), 3);
  assert.equal(starsFor(l, l.twoStar), 2);
  assert.equal(starsFor(l, l.twoStar + 1), 1);
  assert.equal(starsFor(l, l.maxMoves), 1);
  assert.equal(starsFor(l, l.maxMoves + 1), 0);
  const first = recordResult({}, 1, 3, 1);
  assert.deepEqual(recordResult(first, 1, 1, 9), first);
  assert.equal(totalStars(first), 3);
  assert.equal(unlockedLevel(first, 135), 2);
});

test('Clearing a world opens the next; only 81/81 shards forge its Heart', () => {
  const p: Record<string, { stars: number; moves: number }> = {};
  for (let i = 1; i <= 27; i++) p[i] = { stars: 3, moves: 1 };
  assert.equal(worldCleared(p, 0), true);
  assert.equal(unlockedLevel(p, 136), 28);
  assert.deepEqual(heartsEarned(p), [0]);
  p[5] = { stars: 2, moves: 4 };
  assert.equal(worldShards(p, 0), 80);
  assert.deepEqual(heartsEarned(p), []);
  assert.equal(worldCleared(p, 0), true);
  for (let i = 1; i <= 135; i++) p[i] = { stars: 3, moves: 1 };
  assert.deepEqual(heartsEarned(p), [0, 1, 2, 3, 4]);
});

test('Every cannon fires; a beam stops at another cannon', () => {
  const level = base({
    emitters: [{ id: 'e1', position: [0, 1], direction: 'E' }, { id: 'e2', position: [0, 3], direction: 'E' }],
    targets: [{ id: 'a', position: [3, 1] }, { id: 'b', position: [3, 3] }],
  });
  assert.equal(traceBeam(level, {}).won, true);
  const into = base({ emitters: [{ id: 'e1', position: [0, 1], direction: 'E' }, { id: 'e2', position: [3, 1], direction: 'S' }], targets: [{ id: 'a', position: [4, 1] }] });
  assert.equal(traceBeam(into, {}).activated.length, 0);
});

test('Turnable cannons rotate clockwise when tapped', () => {
  const level = base({ emitters: [{ id: 'e1', position: [2, 2], direction: 'N', rotatable: true }], targets: [{ id: 'a', position: [2, 4] }] });
  let s = initialState(level);
  assert.ok(tappables(level).includes('e1'));
  s = applyMove(level, s, 'e1');
  assert.equal(s.aims.e1, 'E');
  assert.deepEqual(solve(level, initialState(level)), ['e1', 'e1']);
  const fixed = base({});
  assert.equal(canRotate(fixed, initialState(fixed), 'e1'), false);
});

test('Cursed gems absorb the beam and block the win', () => {
  const level = base({ hazards: [{ id: 'h', position: [4, 2] }], targets: [{ id: 'a', position: [2, 2] }] });
  const t = traceBeam(level, {});
  assert.deepEqual(t.hazardsLit, ['h']);
  assert.equal(t.won, false);
});

// A player wastes moves by tapping a spare piece back and forth (or round in a full circle for a cannon).
function wasteTap(level: Level) {
  const start = initialState(level);
  return [...tappables(level)].sort((a, b) => Number(a.startsWith('e')) - Number(b.startsWith('e')))
    .find(id => canRotate(level, start, id) && !traceState(level, applyMove(level, start, id)).won);
}
function play(level: Level, taps: string[]) {
  let s = initialState(level);
  for (let k = 0; k < taps.length; k++) {
    s = applyMove(level, s, taps[k]!);
    if (traceState(level, s).won) return { won: true, moves: k + 1, shards: starsFor(level, k + 1) };
    if (k + 1 >= level.maxMoves) return { won: false, moves: k + 1, shards: 0 };
  }
  return { won: false, moves: taps.length, shards: 0 };
}

for (const level of levels) {
  test(`Level ${level.id}: 3, 2, 1 and 0 shards are all reachable within ${level.maxMoves} moves`, () => {
    const path = solve(level, initialState(level))!;
    const spare = wasteTap(level)!;
    assert.ok(spare, 'needs a spare tap');
    const cycle = level.emitters.some(e => e.id === spare) ? 4 : 2;
    const waste = (rounds: number) => Array.from({ length: rounds * cycle }, () => spare);
    // Wasting a full cycle only revisits the start, which is never solved.
    assert.deepEqual(play(level, path), { won: true, moves: level.par, shards: 3 });
    const two = play(level, [...waste(1), ...path]);
    if (cycle === 2) assert.deepEqual(two, { won: true, moves: level.par + 2, shards: 2 });
    const oneRounds = Math.ceil((level.twoStar + 1 - level.par) / cycle);
    const one = play(level, [...waste(oneRounds), ...path]);
    if (level.par + oneRounds * cycle <= level.maxMoves) assert.deepEqual(one, { won: true, moves: level.par + oneRounds * cycle, shards: 1 });
    const zero = play(level, waste(Math.ceil(level.maxMoves / cycle) + 1));
    assert.deepEqual(zero, { won: false, moves: level.maxMoves, shards: 0 });
  });
}

test('From the middle of the first world on, levels defeat the "tap the last mirror the light hits" strategy', () => {
  for (let c = 0; c < 5; c++) {
    const from = c === 0 ? 9 : 1;
    const pool = levels.filter(l => l.chapter === c && l.index > from);
    const beaten = pool.filter(l => greedyPlay(l, initialState(l), l.par, true) === null);
    assert.ok(beaten.length >= pool.length * (c === 0 ? .5 : .85), `chapter ${c + 1}: only ${beaten.length}/${pool.length} need planning`);
  }
  for (const l of levels.filter(x => x.boss)) assert.equal(greedyPlay(l, initialState(l), l.par, true), null, `boss ${l.id} is greedy-solvable`);
});

test('Difficulty climbs: par, cannons and mechanics grow across the journey', () => {
  const avg = (c: number, f: (l: Level) => number) => levels.filter(l => l.chapter === c).reduce((s, l) => s + f(l), 0) / 27;
  for (let c = 1; c < 5; c++) {
    assert.ok(avg(c, l => l.par) >= avg(c - 1, l => l.par) - .2, `par dips in chapter ${c + 1}`);
    assert.ok(avg(c, l => l.mechanics.length) >= avg(c - 1, l => l.mechanics.length) - .2, `mechanics dip in chapter ${c + 1}`);
  }
  assert.equal(levels.at(-1)!.emitters.length, 3);
});
