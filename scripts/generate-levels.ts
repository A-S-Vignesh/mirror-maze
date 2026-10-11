// Builds the 135 campaign levels. Every candidate is verified by the BFS solver; par is the true optimum.
// Mid and late levels must also defeat a simulated "follow the beam" player, so they need real planning.
// Run: npx tsx scripts/generate-levels.ts
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DELTA, greedyPlay, initialState, key, orientationFor, reflect, solve, traceBeam, traceState, turnLeft, turnRight } from '../src/game/engine';
import { Direction, Emitter, Level, Mechanic, Mirror, Orientation, Point } from '../src/game/types';

export interface Spec {
  size: number; emitters: number; rotatable: number; turns: number; pass: number; splitters: number; portals: number;
  links: number; frozen: number; fixed: number; blockers: number; decoys: number; hazards: number;
  minPar: number; maxPar: number;
  /** 0: any; 1: must beat a player who only taps lit mirrors; 2: must also beat one who tries every tap. */
  trap: number; slack: number; boss: boolean;
}

const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

export function spec(c: number, i: number): Spec {
  const t = i / 26;
  const boss = i === 26;
  const s: Spec = { size: 6, emitters: 1, rotatable: 0, turns: 2, pass: 0, splitters: 0, portals: 0, links: 0, frozen: 0, fixed: 0,
    blockers: 0, decoys: 0, hazards: 0, minPar: 2, maxPar: 3, trap: 0, slack: 4, boss };
  const par = (a: number, b: number) => { s.minPar = a; s.maxPar = b; };
  if (c === 0) {
    // Sky Temples: turning mirrors, stones, golden fixed mirrors, several crystals, then twin suns.
    s.size = i < 3 ? 4 : i < 9 ? 5 : i < 19 ? 6 : 7;
    s.emitters = i >= 18 ? 2 : 1;
    s.turns = i === 0 ? 1 : i < 9 ? 2 : s.emitters > 1 ? 2 : 3;
    s.pass = i >= 6 && i < 18 ? (i >= 13 ? 2 : 1) : i >= 21 ? 1 : 0;
    s.fixed = i >= 4 ? (i >= 14 ? 2 : 1) : 0;
    s.blockers = i >= 3 ? lerp(1, 4, t) : 0;
    s.decoys = i >= 9 ? (i >= 16 ? 2 : 1) : i === 0 ? 1 : 0;
    if (i === 0) par(1, 1); else if (i === 1) par(1, 2); else if (i === 2) par(2, 2);
    else if (i < 9) par(2, 3); else if (i < 18) par(3, 4); else if (i === 18) par(2, 3); else if (!boss) par(3, 5); else par(5, 6);
    s.trap = i < 9 || i === 18 ? 0 : i < 18 ? i % 2 : 1;
    s.slack = i < 9 ? 6 : 5;
  } else if (c === 1) {
    // Rainforest: vine-linked mirrors, then spirit totems that turn, then twin totems.
    s.size = i < 3 ? 5 : i < 16 ? 6 : 7;
    s.links = i >= 13 ? 2 : 1;
    s.rotatable = (i >= 9 && i % 2 === 1) || boss ? 1 : 0;
    s.emitters = (i >= 18 && i % 2 === 0) || boss ? 2 : 1;
    s.turns = s.emitters > 1 ? 2 : lerp(2, 4, t);
    s.pass = i >= 5 ? (i >= 20 && s.emitters === 1 ? 2 : 1) : 0;
    s.fixed = i >= 3 ? lerp(1, 2, t) : 0;
    s.blockers = lerp(1, 4, t);
    s.decoys = lerp(1, 2, t);
    if (i === 0) par(2, 3); else if (i < 9) par(3, 4); else if (i === 9) par(2, 3); else if (i < 18) par(3, 5); else if (!boss) par(4, 6); else par(5, 7);
    s.trap = i === 0 || i === 9 ? 0 : (i >= 20 && i % 2 === 0) || boss ? 2 : 1;
    s.slack = 5;
  } else if (c === 2) {
    // Desert: Ra's prisms, then cursed shadow gems that must stay dark, twin suns and turning eyes.
    s.size = i < 10 ? 6 : 7;
    s.splitters = i >= 16 ? 2 : 1;
    s.hazards = i >= 8 ? (i >= 17 ? 2 : 1) : 0;
    s.emitters = (i >= 14 && i % 3 === 2) || boss ? 2 : 1;
    if (s.emitters > 1) s.splitters = 1;
    s.links = i >= 11 && i % 2 === 1 ? 1 : 0;
    s.rotatable = i >= 19 && i % 3 === 0 ? 1 : 0;
    s.turns = s.emitters > 1 ? 2 : lerp(2, 4, t);
    s.pass = i >= 4 ? 1 : 0;
    s.fixed = lerp(1, 2, t);
    s.blockers = lerp(2, 4, t);
    s.decoys = lerp(1, 2, t);
    if (i === 0) par(2, 3); else if (i < 8) par(3, 5); else if (i === 8) par(2, 4); else if (!boss) par(4, 6); else par(6, 7);
    s.trap = i === 0 || i === 8 ? 0 : (i >= 18 && i % 2 === 1) || boss ? 2 : 1;
    s.slack = 4;
  } else if (c === 3) {
    // Ice Age: frozen mirrors thaw in the light, then three frost lanterns at once.
    s.size = i < 6 ? 6 : 7;
    s.frozen = i >= 19 ? 3 : i >= 10 ? 2 : 1;
    s.emitters = i >= 12 ? (i % 3 === 0 ? 3 : i % 3 === 1 ? 2 : 1) : 1;
    if (boss) s.emitters = 3;
    s.hazards = i >= 4 ? (i >= 18 ? 2 : 1) : 0;
    s.splitters = i >= 8 && i % 2 === 0 && s.emitters < 3 ? 1 : 0;
    s.links = i >= 6 && i % 3 === 1 ? 1 : 0;
    s.rotatable = i >= 16 && i % 4 === 0 ? 1 : 0;
    s.turns = s.emitters > 1 ? 2 : lerp(2, 4, t);
    s.pass = i >= 3 && s.emitters === 1 ? 1 : 0;
    s.fixed = lerp(1, 2, t);
    s.blockers = lerp(2, 4, t);
    s.decoys = lerp(1, 2, t);
    if (i === 0) par(2, 3); else if (i < 12) par(3, 5); else if (i === 12) par(3, 5); else if (!boss) par(4, 6); else par(6, 8);
    s.trap = i === 0 || i === 12 ? 0 : (i >= 16 && i % 2 === 0) || boss ? 2 : 1;
    s.frozen = Math.min(s.frozen, s.emitters * s.turns - 1);
    s.slack = 4;
  } else {
    // The Void: wormholes, then every trick the Lightkeeper has learned.
    s.size = 7;
    s.portals = i >= 13 && i % 2 === 1 ? 2 : 1;
    s.emitters = boss ? 3 : i >= 6 ? (i % 3 === 0 ? 3 : i % 3 === 1 ? 2 : 1) : 1;
    s.hazards = i >= 2 ? (i >= 14 ? 2 : 1) : 0;
    s.splitters = i >= 4 && i % 2 === 0 && s.emitters < 3 ? 1 : 0;
    s.frozen = i >= 9 && i % 3 === 2 ? 1 : 0;
    s.links = i >= 5 && i % 4 === 1 ? 1 : 0;
    s.rotatable = i >= 7 && i % 4 === 3 ? 1 : 0;
    s.turns = s.emitters > 1 ? 2 : lerp(3, 4, t);
    s.pass = i >= 3 && s.emitters < 3 ? 1 : 0;
    s.fixed = lerp(1, 2, t);
    s.blockers = lerp(2, 4, t);
    s.decoys = lerp(1, 2, t);
    if (i === 0) par(2, 4); else if (i < 13) par(4, 6); else if (!boss) par(5, 7); else par(6, 8);
    s.trap = i === 0 ? 0 : (i >= 13 && i % 2 === 0) || boss ? 2 : 1;
    s.slack = 4;
  }
  s.rotatable = Math.min(s.rotatable, s.emitters);
  // Make sure there are enough turnable mirrors on the light's path to reach the target par.
  const cap = ({ 4: 2, 5: 3, 6: 5, 7: 6 } as Record<number, number>)[s.size]!;
  const need = () => s.minPar - s.rotatable + s.fixed + s.links;
  s.turns = Math.min(Math.max(s.turns, Math.ceil(need() / s.emitters)), s.emitters > 2 ? 3 : s.emitters > 1 ? 4 : cap);
  while (s.emitters * s.turns < need() && s.fixed > 0) s.fixed--;
  s.minPar = Math.min(s.minPar, s.emitters * s.turns - s.fixed - s.links + s.rotatable);
  s.maxPar = Math.max(s.maxPar, s.minPar);
  return s;
}

export function mulberry(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const reasons: Record<string, number> = {};
const fail = (why: string): null => { reasons[why] = (reasons[why] ?? 0) + 1; return null; };
type Raw = Omit<Level, 'title' | 'beat' | 'id' | 'chapter' | 'index'>;

export function attempt(sp: Spec, rnd: () => number): Raw | null {
  const N = sp.size;
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]!;
  const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; } return a; };
  const occ = new Set<string>();
  const beam = new Set<string>();
  const inb = (p: Point) => p[0] >= 0 && p[1] >= 0 && p[0] < N && p[1] < N;
  const free = (p: Point) => inb(p) && !occ.has(key(p));
  const add = (p: Point, d: Direction, k: number): Point => [p[0] + DELTA[d][0] * k, p[1] + DELTA[d][1] * k];
  const dirs: Direction[] = ['N', 'E', 'S', 'W'];

  // Cannons sit on the rim facing inward where possible, so they read as cannons rather than clutter.
  const emitters: Emitter[] = [];
  for (let e = 0; e < sp.emitters; e++) {
    let ok = false;
    for (let g = 0; g < 60 && !ok; g++) {
      const edge = rnd() < .85;
      let p: Point, d: Direction;
      if (edge) {
        const side = pick(dirs), along = Math.floor(rnd() * N);
        p = side === 'N' ? [along, 0] : side === 'S' ? [along, N - 1] : side === 'W' ? [0, along] : [N - 1, along];
        d = side === 'N' ? 'S' : side === 'S' ? 'N' : side === 'W' ? 'E' : 'W';
      } else { p = [Math.floor(rnd() * N), Math.floor(rnd() * N)]; d = pick(dirs); }
      if (!free(p) || beam.has(key(p)) || !free(add(p, d, 1)) || !free(add(p, d, 2)) || beam.has(key(add(p, d, 1)))) continue;
      emitters.push({ id: `e${e + 1}`, position: p, direction: d, ...(e < sp.rotatable ? { rotatable: true } : {}) });
      occ.add(key(p));
      ok = true;
    }
    if (!ok) return fail('emitter');
  }

  const mirrors: { p: Point; o: Orientation; din: Direction }[] = [];
  const targets: Point[] = [];
  const splitters: Point[] = [];
  const portals: [Point, Point][] = [];
  interface Task { pos: Point; dir: Direction; turns: number; pass: number; splits: number; portals: number }
  const share = (total: number, k: number, parts: number) => Math.floor(total / parts) + (k < total % parts ? 1 : 0);
  const stack: Task[] = emitters.map((e, k) => ({ pos: e.position, dir: e.direction, turns: sp.turns,
    pass: share(sp.pass, k, sp.emitters), splits: share(sp.splitters, k, sp.emitters), portals: share(sp.portals, k, sp.emitters) })).reverse();
  while (stack.length) {
    const task = stack.pop()!;
    let { pos, dir } = task;
    for (let guard = 0; ; guard++) {
      if (guard > 30) return fail('guard');
      const lengths: number[] = [];
      for (let L = 1; L < N; L++) {
        const p = add(pos, dir, L);
        if (!free(p)) break;
        if (!beam.has(key(p))) lengths.push(L);
      }
      if (!lengths.length) return fail('stuck');
      const done = task.turns === 0 && task.splits === 0 && task.portals === 0 && task.pass === 0;
      const events: string[] = done ? ['end'] : shuffle([
        ...(task.turns > 0 ? ['mirror', 'mirror', 'mirror'] : []),
        ...(task.splits > 0 ? ['split', 'split'] : []),
        ...(task.portals > 0 ? ['portal', 'portal'] : []),
        ...(task.pass > 0 ? ['pass'] : []),
      ]);
      const fits = (ev: string, L: number) => {
        const E = add(pos, dir, L);
        if (ev === 'pass') return free(add(E, dir, 1));
        if (ev === 'mirror') return [turnLeft(dir), turnRight(dir)].some(nd => free(add(E, nd, 1)));
        if (ev === 'split') return free(add(E, turnLeft(dir), 1)) && free(add(E, turnRight(dir), 1));
        return true;
      };
      let ev = '', choices: number[] = [];
      for (const candidate of events) {
        choices = lengths.filter(l => fits(candidate, l));
        if (choices.length) { ev = candidate; break; }
      }
      if (!ev) return fail('event');
      const longish = choices.filter(l => l >= 2);
      const L = pick(longish.length && rnd() < .75 ? longish : choices);
      const E = add(pos, dir, L);
      for (let k = 1; k <= L; k++) beam.add(key(add(pos, dir, k)));
      occ.add(key(E));
      if (ev === 'end') { targets.push(E); break; }
      if (ev === 'pass') { targets.push(E); task.pass--; pos = E; continue; }
      if (ev === 'mirror') {
        const nd = pick([turnLeft(dir), turnRight(dir)].filter(d => free(add(E, d, 1))));
        mirrors.push({ p: E, o: orientationFor(dir, nd)!, din: dir });
        task.turns--; dir = nd; pos = E; continue;
      }
      if (ev === 'split') {
        const l = turnLeft(dir), r = turnRight(dir);
        splitters.push(E);
        task.splits--;
        const half = (v: number) => { const a = Math.floor(v / 2 + (rnd() < .5 ? 0 : .5)); return [a, v - a] as const; };
        const [t1, t2] = half(task.turns), [p1, p2] = half(task.pass), [s1, s2] = half(task.splits), [q1, q2] = half(task.portals);
        stack.push({ pos: E, dir: r, turns: t2, pass: p2, splits: s2, portals: q2 });
        task.turns = t1; task.pass = p1; task.splits = s1; task.portals = q1;
        dir = l; pos = E; continue;
      }
      const exits: Point[] = [];
      for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
        const X: Point = [x, y];
        if (free(X) && !beam.has(key(X)) && free(add(X, dir, 1)) && Math.abs(x - E[0]) + Math.abs(y - E[1]) > 2) exits.push(X);
      }
      if (!exits.length) return fail('portal');
      const X = pick(exits);
      occ.add(key(X)); beam.add(key(X));
      portals.push([E, X]);
      task.portals--; pos = X;
    }
  }

  // Cells a wrongly turned mirror (or cannon) would shine into: the best spots for traps and red herrings.
  const lure = new Set<string>();
  for (const m of mirrors) {
    const wrong = reflect(m.din, (1 - m.o) as Orientation);
    for (let k = 1; k <= 3; k++) { const p = add(m.p, wrong, k); if (!inb(p)) break; lure.add(key(p)); }
  }
  for (const e of emitters) if (e.rotatable) for (const d of dirs) if (d !== e.direction) for (let k = 1; k <= 3; k++) {
    const p = add(e.position, d, k); if (!inb(p)) break; lure.add(key(p));
  }

  const empty: Point[] = [];
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) if (!occ.has(`${x},${y}`) && !beam.has(`${x},${y}`)) empty.push([x, y]);
  const take = (count: number, prefer: (p: Point) => boolean, allowed: (p: Point) => boolean = () => true) => {
    const out: Point[] = [];
    for (let k = 0; k < count; k++) {
      const pool = empty.filter(allowed);
      if (!pool.length) break;
      const good = pool.filter(prefer);
      const p = pick(good.length && rnd() < .8 ? good : pool);
      empty.splice(empty.indexOf(p), 1);
      out.push(p);
    }
    return out;
  };
  const nearBeam = (p: Point) => dirs.some(d => beam.has(key(add(p, d, 1))));
  const blockers = take(sp.blockers, nearBeam);
  const decoys = take(sp.decoys, p => lure.has(key(p)) || nearBeam(p)).map(p => ({ p, o: (rnd() < .5 ? 0 : 1) as Orientation }));
  if (blockers.length < sp.blockers || decoys.length < sp.decoys) return fail('space');

  const all: Mirror[] = [
    ...mirrors.map((m, i) => ({ id: `m${i + 1}`, position: m.p, orientation: m.o, fixed: false })),
    ...decoys.map((m, i) => ({ id: `d${i + 1}`, position: m.p, orientation: m.o, fixed: false })),
  ];
  const sol = all.slice(0, mirrors.length);
  const pool = shuffle([...sol]);
  for (let k = 0; k < sp.fixed && pool.length > 2; k++) pool.pop()!.fixed = true;
  for (let k = 0; k < sp.frozen && pool.length; k++) pool.pop()!.frozen = true;
  const linkable = shuffle(all.filter(m => !m.fixed && !m.frozen));
  for (let k = 0; k < sp.links; k++) {
    const a = linkable.pop(), b = linkable.pop();
    if (!a || !b) return fail('link');
    a.link = b.link = `v${k + 1}`;
  }
  const solution = Object.fromEntries(all.map(m => [m.id, m.orientation])) as Record<string, Orientation>;
  const solutionAims = Object.fromEntries(emitters.map(e => [e.id, e.direction])) as Record<string, Direction>;
  // Engine indexes are cached per level object, so every change below creates a fresh object.
  let level: Level = {
    id: 0, chapter: 0, index: 0, title: '', beat: '', size: N,
    emitters, mirrors: all, targets: targets.map((p, i) => ({ id: `c${i + 1}`, position: p })),
    blockers, splitters: splitters.map((p, i) => ({ id: `s${i + 1}`, position: p })),
    portals: portals.map(([a, b], i) => ({ id: `p${i + 1}`, position: a, exit: b })), hazards: [],
    solution, solutionAims, par: 0, twoStar: 0, maxMoves: 0, boss: sp.boss, mechanics: [],
  };
  const solved = traceBeam(level, solution, solutionAims);
  if (!solved.won) return fail('solution');

  // Scramble: wrong-turn a set of mirror groups on the path, shuffle decoys, and swing turnable cannons away.
  const movable = all.filter(m => !m.fixed);
  const groupOfM = (m: Mirror) => m.link ?? m.id;
  const pathGroups = shuffle([...new Set(movable.filter(m => m.id.startsWith('m')).map(groupOfM))]);
  const orient = { ...solution };
  const aims = { ...solutionAims };
  const want = sp.minPar + Math.floor(rnd() * (sp.maxPar - sp.minPar + 1));
  const turns = emitters.filter(e => e.rotatable).length;
  const taps = Math.min(pathGroups.length, Math.max(1, want - turns));
  const toggle = (g: string) => { for (const m of movable) if (groupOfM(m) === g) orient[m.id] = orient[m.id] === 0 ? 1 : 0; };
  pathGroups.slice(0, taps).forEach(toggle);
  for (const d of movable.filter(m => m.id.startsWith('d') && !m.link)) if (rnd() < .5) toggle(d.id);
  for (const e of emitters) if (e.rotatable) {
    const spin = 1 + Math.floor(rnd() * 3);
    let d = e.direction;
    for (let k = 0; k < 4 - spin; k++) d = turnRight(d);
    aims[e.id] = d;
  }
  level = { ...level, mirrors: all.map(m => ({ ...m, orientation: orient[m.id]! })), emitters: emitters.map(e => ({ ...e, direction: aims[e.id]! })) };

  // Shadow gems go where the solved beam never shines: often right in the opening beam's way,
  // otherwise where a wrong turn would send the light.
  if (sp.hazards) {
    const cells = (segs: { from: Point; to: Point; length: number }[]) => {
      const out = new Set<string>();
      for (const s of segs) {
        const dx = Math.sign(s.to[0] - s.from[0]), dz = Math.sign(s.to[1] - s.from[1]);
        for (let k = 0; k <= Math.ceil(s.length); k++) out.add(`${Math.round(s.from[0] + dx * k)},${Math.round(s.from[1] + dz * k)}`);
      }
      return out;
    };
    const shone = cells(solved.segments);
    const opening = cells(traceBeam(level, orient, aims).segments);
    const spots: Point[] = [];
    for (let k = 0; k < sp.hazards; k++) {
      const inWay = k === 0 && rnd() < .65;
      const got = take(1, p => (inWay ? opening.has(key(p)) : lure.has(key(p))), p => !shone.has(key(p)));
      spots.push(...got);
    }
    if (spots.length < sp.hazards) return fail('hazard-space');
    level = { ...level, hazards: spots.map((p, i) => ({ id: `h${i + 1}`, position: p })) };
    if (!traceBeam(level, solution, solutionAims).won) return fail('hazard-solution');
  }
  const start = initialState(level);
  const startTrace = traceState(level, start);
  if (startTrace.won) return fail('pre-solved');
  const path = solve(level, start, 80000);
  if (!path) return fail('unsolved');
  if (path.length < sp.minPar) return fail('par-low');
  if (path.length > sp.maxPar) return fail('par-high');
  const byId = new Map(level.mirrors.map(m => [m.id, m]));
  if (sp.links && !path.some(id => byId.get(id)?.link)) return fail('link-unused');
  if (sp.frozen && !path.some(id => byId.get(id)?.frozen)) return fail('frozen-unused');
  if (sp.rotatable && !path.some(id => id.startsWith('e'))) return fail('turn-unused');
  if (sp.hazards) {
    // The shadow gems must matter: either the opening beam already hits one, or ignoring them would make it easier.
    const free = solve({ ...level, hazards: [] }, initialState({ ...level, hazards: [] }), 80000);
    if (!startTrace.hazardsLit.length && (!free || free.length >= path.length)) return fail('hazard-idle');
  }
  if (sp.trap >= 1 && greedyPlay(level, start, path.length, true) !== null) return fail('trap1');
  if (sp.trap >= 2 && greedyPlay(level, start, path.length, false) !== null) return fail('trap2');
  level.par = path.length;
  level.twoStar = level.par + 2;
  level.maxMoves = level.par + sp.slack;
  const mech = new Set<Mechanic>(['mirror', 'limit']);
  if (blockers.length) mech.add('blocker');
  if (level.mirrors.some(m => m.fixed)) mech.add('fixed');
  if (decoys.length) mech.add('decoy');
  if (level.targets.length > level.emitters.length) mech.add('multi');
  if (level.mirrors.some(m => m.link)) mech.add('link');
  if (splitters.length) mech.add('splitter');
  if (level.mirrors.some(m => m.frozen)) mech.add('frozen');
  if (portals.length) mech.add('portal');
  if (level.emitters.length === 2) mech.add('twin');
  if (level.emitters.length >= 3) mech.add('triple');
  if (level.emitters.some(e => e.rotatable)) mech.add('turn');
  if (level.hazards.length) mech.add('hazard');
  level.mechanics = [...mech];
  const { id: _i, chapter: _c, index: _x, title: _t, beat: _b, ...raw } = level;
  return raw;
}

function build(c: number, i: number): Raw {
  let sp = spec(c, i);
  for (let a = 0; ; a++) {
    if (a > 0 && a % 2500 === 0) {
      // Rarely a spec is too tight for the board; ease the trap rule first, then the target par.
      sp = sp.trap > 1 ? { ...sp, trap: sp.trap - 1 } : { ...sp, minPar: Math.max(1, sp.minPar - 1), trap: Math.max(0, sp.trap - (a % 5000 === 0 ? 1 : 0)) };
      console.warn(`\nrelaxing chapter ${c + 1} level ${i + 1}: minPar ${sp.minPar} trap ${sp.trap}`);
    }
    const found = attempt(sp, mulberry((c * 1000 + i) * 7919 + a));
    if (found) return found;
  }
}

if (process.env.MM_DEBUG) {
  const [c, i] = process.env.MM_DEBUG.split(',').map(Number);
  const sp = spec(c!, i!);
  let ok = 0;
  const t0 = Date.now();
  for (let a = 0; a < 1500; a++) if (attempt(sp, mulberry(a))) ok++;
  console.log(JSON.stringify(sp), 'ok', ok, `${Date.now() - t0}ms`, reasons);
  process.exit(0);
}
const out: Raw[] = [];
for (let c = 0; c < 5; c++) {
  for (let i = 0; i < 27; i++) {
    const found = build(c, i);
    out.push(found);
    process.stdout.write(`${c * 27 + i + 1}:${found.par}/${found.emitters.length} `);
  }
  console.log();
}
writeFileSync(join(__dirname, '..', 'src', 'game', 'levels.json'), JSON.stringify(out));
console.log(`Wrote ${out.length} levels`);
