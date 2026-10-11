export type Point = readonly [number, number];
export type Direction = 'N' | 'E' | 'S' | 'W';
export type Orientation = 0 | 1;

export interface Mirror {
  id: string;
  position: Point;
  orientation: Orientation;
  fixed: boolean;
  /** Ice-locked until the beam touches it (Chapter 4). */
  frozen?: boolean;
  /** Mirrors sharing a link id rotate together (Chapter 2 vines). */
  link?: string;
}
export interface Target { id: string; position: Point }
export interface Portal { id: string; position: Point; exit: Point }
export interface Splitter { id: string; position: Point }
/** A light cannon. Rotatable cannons turn clockwise when tapped. */
export interface Emitter { id: string; position: Point; direction: Direction; rotatable?: boolean }
/** Shadow gems drink light: the level cannot be won while any beam touches one. */
export interface Hazard { id: string; position: Point }

export type Mechanic = 'mirror' | 'blocker' | 'fixed' | 'decoy' | 'multi' | 'link' | 'splitter' | 'limit' | 'frozen' | 'portal' | 'twin' | 'triple' | 'turn' | 'hazard';

export interface Level {
  id: number;
  chapter: number;
  index: number;
  title: string;
  beat: string;
  size: number;
  emitters: Emitter[];
  mirrors: Mirror[];
  targets: Target[];
  blockers: Point[];
  portals: Portal[];
  splitters: Splitter[];
  hazards: Hazard[];
  solution: Record<string, Orientation>;
  solutionAims: Record<string, Direction>;
  par: number;
  twoStar: number;
  maxMoves: number;
  boss: boolean;
  mechanics: Mechanic[];
}

export interface BeamSegment {
  from: Point;
  to: Point;
  /** Path distance from the emitter where this segment starts. */
  start: number;
  length: number;
  /** Ray branch index; prisms spawn child branches (see Trace.parents). */
  branch: number;
  exit?: boolean;
  blocked?: boolean;
}
export interface BeamHit { point: Point; at: number; kind: 'mirror' | 'blocker' | 'splitter' | 'portal' | 'target' | 'hazard'; branch: number }
export interface Trace {
  segments: BeamSegment[];
  hits: BeamHit[];
  activated: string[];
  activatedAt: Record<string, number>;
  litMirrors: string[];
  hazardsLit: string[];
  /** parents[branch] is the branch a prism split from (-1 for a cannon's own ray; branch k < emitters.length belongs to cannon k). */
  parents: number[];
  won: boolean;
  loop: boolean;
}
export interface PlayState {
  orientations: Record<string, Orientation>;
  thawed: Record<string, boolean>;
  aims: Record<string, Direction>;
}
