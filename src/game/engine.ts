import { Direction, Level, Mirror, Orientation, PlayState, Point, Trace, BeamSegment, BeamHit } from './types';

export const DELTA: Record<Direction, Point> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const REFLECT: Record<Orientation, Record<Direction, Direction>> = {
  0: { N: 'E', E: 'N', S: 'W', W: 'S' },
  1: { N: 'W', W: 'N', S: 'E', E: 'S' },
};
const LEFT: Record<Direction, Direction> = { N: 'W', W: 'S', S: 'E', E: 'N' };
const RIGHT: Record<Direction, Direction> = { N: 'E', E: 'S', S: 'W', W: 'N' };

export const key = (p: Point) => `${p[0]},${p[1]}`;
export const reflect = (d: Direction, o: Orientation) => REFLECT[o][d];
export const turnLeft = (d: Direction) => LEFT[d];
export const turnRight = (d: Direction) => RIGHT[d];
export const orientationFor = (incoming: Direction, outgoing: Direction): Orientation | undefined =>
  REFLECT[0][incoming] === outgoing ? 0 : REFLECT[1][incoming] === outgoing ? 1 : undefined;

interface Index {
  mirrors: Map<string, Mirror>;
  blockers: Set<string>;
  targets: Map<string, string>;
  hazards: Map<string, string>;
  portals: Map<string, Point>;
  splitters: Set<string>;
}
const indexCache = new WeakMap<Level, Index>();
function indexOf(level: Level): Index {
  let idx = indexCache.get(level);
  if (!idx) {
    idx = {
      mirrors: new Map(level.mirrors.map(m => [key(m.position), m])),
      // Cannons are solid: a beam that runs into another cannon stops there.
      blockers: new Set([...level.blockers.map(key), ...level.emitters.map(e => key(e.position))]),
      targets: new Map(level.targets.map(t => [key(t.position), t.id])),
      hazards: new Map((level.hazards ?? []).map(h => [key(h.position), h.id])),
      portals: new Map(level.portals.map(p => [key(p.position), p.exit])),
      splitters: new Set(level.splitters.map(s => key(s.position))),
    };
    indexCache.set(level, idx);
  }
  return idx;
}

export const defaultAims = (level: Level): Record<string, Direction> => Object.fromEntries(level.emitters.map(e => [e.id, e.direction]));

interface Ray { pos: Point; dir: Direction; dist: number; branch: number; root: number }

/**
 * Traces every beam (every cannon, including prism branches) through the board. Pure and deterministic.
 * Branch k (k < emitters.length) is cannon k's own ray; prisms append child branches.
 */
export function traceBeam(level: Level, orientations: Record<string, Orientation>, aims?: Record<string, Direction>): Trace {
  const idx = indexOf(level);
  const segments: BeamSegment[] = [];
  const hits: BeamHit[] = [];
  const activatedAt: Record<string, number> = {};
  const lit = new Set<string>();
  const hazardsLit = new Set<string>();
  const visited = new Set<string>();
  const parents: number[] = level.emitters.map(() => -1);
  const queue: Ray[] = level.emitters.map((e, i) => ({ pos: e.position, dir: aims?.[e.id] ?? e.direction, dist: 0, branch: i, root: i }));
  const n = level.size;
  let loop = false;
  let budget = n * n * 16 * Math.max(1, level.emitters.length);
  while (queue.length && budget > 0) {
    const ray = queue.shift()!;
    let pos = ray.pos, dir = ray.dir, dist = ray.dist;
    const { branch, root } = ray;
    let runFrom = pos, runStart = dist;
    const flush = (to: Point, extra: Partial<BeamSegment> = {}) => {
      const length = Math.abs(to[0] - runFrom[0]) + Math.abs(to[1] - runFrom[1]);
      if (length > 0) segments.push({ from: runFrom, to, start: runStart, length, branch, ...extra });
    };
    while (budget-- > 0) {
      const d = DELTA[dir];
      const next: Point = [pos[0] + d[0], pos[1] + d[1]];
      if (next[0] < 0 || next[1] < 0 || next[0] >= n || next[1] >= n) {
        flush([pos[0] + d[0] * .5, pos[1] + d[1] * .5], { exit: true });
        break;
      }
      const state = `${root}:${key(next)}:${dir}`;
      if (visited.has(state)) { loop = true; flush(next); break; }
      visited.add(state);
      const k = key(next);
      if (idx.blockers.has(k)) {
        flush([next[0] - d[0] * .46, next[1] - d[1] * .46], { blocked: true });
        hits.push({ point: [next[0] - d[0] * .46, next[1] - d[1] * .46], at: dist + .54, kind: 'blocker', branch });
        break;
      }
      dist += 1;
      const hazard = idx.hazards.get(k);
      if (hazard !== undefined) {
        flush(next, { blocked: true });
        hazardsLit.add(hazard);
        hits.push({ point: next, at: dist, kind: 'hazard', branch });
        break;
      }
      const target = idx.targets.get(k);
      if (target !== undefined) {
        if (!(target in activatedAt) || activatedAt[target]! > dist) activatedAt[target] = dist;
        hits.push({ point: next, at: dist, kind: 'target', branch });
      }
      const mirror = idx.mirrors.get(k);
      if (mirror) {
        flush(next);
        lit.add(mirror.id);
        hits.push({ point: next, at: dist, kind: 'mirror', branch });
        dir = reflect(dir, mirror.fixed ? mirror.orientation : orientations[mirror.id] ?? mirror.orientation);
        pos = next; runFrom = next; runStart = dist;
        continue;
      }
      if (idx.splitters.has(k)) {
        flush(next);
        hits.push({ point: next, at: dist, kind: 'splitter', branch });
        const left = parents.push(branch) - 1, right = parents.push(branch) - 1;
        queue.push({ pos: next, dir: turnLeft(dir), dist, branch: left, root }, { pos: next, dir: turnRight(dir), dist, branch: right, root });
        break;
      }
      const exit = idx.portals.get(k);
      if (exit) {
        flush(next);
        hits.push({ point: next, at: dist, kind: 'portal', branch }, { point: exit, at: dist, kind: 'portal', branch });
        pos = exit; runFrom = exit; runStart = dist;
        continue;
      }
      pos = next;
    }
  }
  const activated = Object.keys(activatedAt);
  return {
    segments, hits, activatedAt, activated, litMirrors: [...lit], hazardsLit: [...hazardsLit], loop, parents,
    won: level.targets.length > 0 && level.targets.every(t => t.id in activatedAt) && hazardsLit.size === 0,
  };
}

export const traceState = (level: Level, state: PlayState) => traceBeam(level, state.orientations, state.aims);

/**
 * Presentation helper for a solved board: trims every beam branch so it ends inside the last crystal it feeds,
 * instead of continuing past it. Branches that feed no crystal are removed entirely.
 */
export function clipToCrystals(trace: Trace): Trace {
  const reach = new Map<number, number>();
  for (const h of trace.hits) {
    if (h.kind !== 'target') continue;
    for (let b = h.branch; b >= 0; b = trace.parents[b] ?? -1) reach.set(b, Math.max(reach.get(b) ?? -1, h.at));
  }
  const segments: BeamSegment[] = [];
  for (const s of trace.segments) {
    const end = reach.get(s.branch);
    if (end === undefined || end <= s.start) continue;
    const length = Math.min(s.length, end - s.start);
    const dx = Math.sign(s.to[0] - s.from[0]), dz = Math.sign(s.to[1] - s.from[1]);
    const clipped = length < s.length;
    segments.push({ ...s, length, to: [s.from[0] + dx * length, s.from[1] + dz * length], exit: s.exit && !clipped, blocked: s.blocked && !clipped });
  }
  const hits = trace.hits.filter(h => (reach.get(h.branch) ?? -1) >= h.at);
  return { ...trace, segments, hits };
}

export function thawFrom(level: Level, state: PlayState, trace = traceState(level, state)): PlayState {
  let thawed = state.thawed;
  for (const id of trace.litMirrors) {
    const m = level.mirrors.find(x => x.id === id);
    if (m?.frozen && !thawed[id]) thawed = { ...thawed, [id]: true };
  }
  return thawed === state.thawed ? state : { ...state, thawed };
}

export function initialState(level: Level): PlayState {
  const base: PlayState = { orientations: Object.fromEntries(level.mirrors.map(m => [m.id, m.orientation])), thawed: {}, aims: defaultAims(level) };
  return thawFrom(level, base);
}

export function canRotate(level: Level, state: PlayState, id: string) {
  const e = level.emitters.find(x => x.id === id);
  if (e) return !!e.rotatable;
  const m = level.mirrors.find(x => x.id === id);
  if (!m || m.fixed) return false;
  const group = m.link ? level.mirrors.filter(x => x.link === m.link) : [m];
  return group.every(g => !g.fixed && (!g.frozen || state.thawed[g.id]));
}

export function groupOf(level: Level, id: string): string[] {
  if (level.emitters.some(e => e.id === id)) return [id];
  const m = level.mirrors.find(x => x.id === id);
  if (!m) return [];
  return m.link ? level.mirrors.filter(x => x.link === m.link).map(x => x.id) : [m.id];
}

/** Every distinct tap a player can make on this level (one id per linked group, plus turnable cannons). */
export function tappables(level: Level): string[] {
  const out: string[] = level.emitters.filter(e => e.rotatable).map(e => e.id);
  const seen = new Set<string>();
  for (const m of level.mirrors) {
    if (m.fixed) continue;
    const g = m.link ? `L:${m.link}` : m.id;
    if (!seen.has(g)) { seen.add(g); out.push(m.id); }
  }
  return out;
}

export function applyMove(level: Level, state: PlayState, id: string): PlayState {
  if (!canRotate(level, state, id)) return state;
  if (level.emitters.some(e => e.id === id)) {
    return thawFrom(level, { ...state, aims: { ...state.aims, [id]: turnRight(state.aims[id] ?? 'N') } });
  }
  const orientations = { ...state.orientations };
  for (const g of groupOf(level, id)) orientations[g] = orientations[g] === 0 ? 1 : 0;
  return thawFrom(level, { orientations, thawed: state.thawed, aims: state.aims });
}

function encoder(level: Level) {
  const movable = level.mirrors.filter(m => !m.fixed);
  const turning = level.emitters.filter(e => e.rotatable);
  return (s: PlayState) => movable.map(m => `${s.orientations[m.id]}${s.thawed[m.id] ? 1 : 0}`).join('') + turning.map(e => s.aims[e.id]).join('');
}

/** Breadth-first search over orientations, cannon aims and thaw state. Returns the shortest list of taps, or null. */
export function solve(level: Level, start: PlayState, maxStates = 200000): string[] | null {
  const encode = encoder(level);
  const moves = tappables(level);
  if (traceState(level, start).won) return [];
  const visited = new Map<string, { prev: string | null; move: string | null }>();
  visited.set(encode(start), { prev: null, move: null });
  let frontier: PlayState[] = [start];
  while (frontier.length && visited.size < maxStates) {
    const next: PlayState[] = [];
    for (const s of frontier) {
      const sk = encode(s);
      for (const g of moves) {
        if (!canRotate(level, s, g)) continue;
        const ns = applyMove(level, s, g);
        const nk = encode(ns);
        if (visited.has(nk)) continue;
        visited.set(nk, { prev: sk, move: g });
        if (traceState(level, ns).won) {
          const path: string[] = [];
          let cur: string | null = nk;
          while (cur) { const v: { prev: string | null; move: string | null } = visited.get(cur)!; if (v.move) path.unshift(v.move); cur = v.prev; }
          return path;
        }
        next.push(ns);
      }
    }
    frontier = next;
  }
  return null;
}

/** How good a board looks to a player who can only judge what the light is doing right now. */
function appeal(level: Level, t: Trace) {
  let inside = 0;
  for (const s of t.segments) inside += s.exit ? s.length - .5 : s.length;
  return t.activated.length * 10 - t.hazardsLit.length * 12 + inside * .05;
}

/**
 * Simulates an impatient player who always makes the single tap that looks best right now.
 * `litOnly` restricts them to mirrors the light is touching (the "tap the last mirror the light hits" strategy).
 * Returns the number of taps they need to win, or null if they do not win within `limit`.
 */
export function greedyPlay(level: Level, start: PlayState, limit: number, litOnly: boolean): number | null {
  let s = start;
  const moves = tappables(level);
  const seen = new Set<string>();
  const encode = encoder(level);
  for (let step = 1; step <= limit; step++) {
    const t = traceState(level, s);
    const lit = new Set(t.litMirrors);
    let best: PlayState | null = null, bestScore = -Infinity;
    for (const id of moves) {
      if (!canRotate(level, s, id)) continue;
      if (litOnly && !level.emitters.some(e => e.id === id) && !groupOf(level, id).some(g => lit.has(g))) continue;
      const ns = applyMove(level, s, id);
      const nt = traceState(level, ns);
      if (nt.won) return step;
      const score = appeal(level, nt) - (seen.has(encode(ns)) ? 100 : 0);
      if (score > bestScore) { bestScore = score; best = ns; }
    }
    if (!best) return null;
    seen.add(encode(s));
    s = best;
  }
  return null;
}

/**
 * Exact move counts at which the level can be completed, given that a winning tap ends the level immediately.
 * Used to prove every shard outcome (3, 2, 1 and a 0-shard fail) is reachable within the move limit.
 */
export function winnableAt(level: Level, upTo: number): Set<number> {
  const encode = encoder(level);
  const moves = tappables(level);
  const out = new Set<number>();
  let layer = new Map<string, PlayState>([[encode(initialState(level)), initialState(level)]]);
  for (let k = 1; k <= upTo && layer.size; k++) {
    const next = new Map<string, PlayState>();
    for (const s of layer.values()) for (const id of moves) {
      if (!canRotate(level, s, id)) continue;
      const ns = applyMove(level, s, id);
      if (traceState(level, ns).won) { out.add(k); continue; }
      next.set(encode(ns), ns);
    }
    layer = next;
  }
  return out;
}

/** True if a player can spend every move without ever winning (the 0-shard "out of moves" outcome). */
export function canRunOut(level: Level): boolean {
  const encode = encoder(level);
  const moves = tappables(level);
  let layer = new Map<string, PlayState>([[encode(initialState(level)), initialState(level)]]);
  for (let k = 1; k <= level.maxMoves && layer.size; k++) {
    const next = new Map<string, PlayState>();
    for (const s of layer.values()) for (const id of moves) {
      if (!canRotate(level, s, id)) continue;
      const ns = applyMove(level, s, id);
      if (!traceState(level, ns).won) next.set(encode(ns), ns);
    }
    layer = next;
  }
  return layer.size > 0;
}

export function starsFor(level: Level, moves: number): number {
  if (moves > level.maxMoves) return 0;
  return moves <= level.par ? 3 : moves <= level.twoStar ? 2 : 1;
}

export function validateLevel(level: Level): string[] {
  const errors: string[] = [];
  const cells = new Set<string>();
  const ids = new Set<string>();
  const occupy = (p: Point, what: string) => {
    if (p.some(v => !Number.isInteger(v) || v < 0 || v >= level.size)) errors.push(`${what} out of bounds ${key(p)}`);
    if (cells.has(key(p))) errors.push(`${what} overlaps ${key(p)}`);
    cells.add(key(p));
  };
  if (!level.emitters.length) errors.push('no light cannon');
  for (const e of level.emitters) occupy(e.position, e.id);
  for (const m of level.mirrors) occupy(m.position, m.id);
  for (const t of level.targets) occupy(t.position, t.id);
  for (const h of level.hazards) occupy(h.position, h.id);
  for (const b of level.blockers) occupy(b, 'blocker');
  for (const s of level.splitters) occupy(s.position, s.id);
  for (const p of level.portals) { occupy(p.position, p.id); occupy(p.exit, `${p.id}-exit`); }
  for (const e of [...level.emitters, ...level.mirrors, ...level.targets, ...level.hazards, ...level.splitters, ...level.portals]) {
    if (ids.has(e.id)) errors.push(`duplicate id ${e.id}`);
    ids.add(e.id);
  }
  for (const m of level.mirrors) {
    if (m.fixed && (m.frozen || m.link)) errors.push(`fixed mirror ${m.id} cannot be frozen or linked`);
    if (m.frozen && m.link) errors.push(`frozen mirror ${m.id} cannot be linked`);
  }
  const start = initialState(level);
  if (traceState(level, start).won) errors.push('already solved');
  if (!traceBeam(level, level.solution, level.solutionAims).won) errors.push('stored solution does not win');
  const path = solve(level, start);
  if (!path) errors.push('unsolvable');
  else if (path.length !== level.par) errors.push(`par ${level.par} but shortest solution is ${path.length}`);
  if (!(level.par < level.twoStar && level.twoStar < level.maxMoves)) errors.push('star thresholds must satisfy par < twoStar < maxMoves');
  return errors;
}
