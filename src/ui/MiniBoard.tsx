import React, { memo } from 'react';
import Svg, { Circle, Defs, Ellipse, G, Line, Path, Polygon, RadialGradient, Rect, Stop, LinearGradient as SvgGradient } from 'react-native-svg';
import { looks } from '../world/look';

export type MiniState = 'done' | 'current' | 'locked';

/** Per-world palette for the floating isles on the journey map. */
const isles = [
  { top: ['#d9c6ae', '#bba48c'], grid: '#a08872', side: ['#a08672', '#6e5a4c'], rock: ['#8a7466', '#5a4a40'], rim: '#7fcf5a' },
  { top: ['#7f9073', '#5f6c5a'], grid: '#4c5646', side: ['#56624e', '#343d30'], rock: ['#4a4036', '#2a2219'], rim: '#4fae3a' },
  { top: ['#ecc68c', '#d6a86a'], grid: '#b88a52', side: ['#cf9e5c', '#a8783e'], rock: ['#c0905a', '#8a6236'], rim: '#f6dcaa' },
  { top: ['#e2f2fc', '#b8d0e4'], grid: '#98b6d0', side: ['#9cc6e4', '#5a88b0'], rock: ['#bfe6fa', '#4a7aa8'], rim: '#ffffff' },
  { top: ['#4e5470', '#33384a'], grid: '#58e0ff', side: ['#3a3f56', '#1c1f2e'], rock: ['#3a3048', '#120e1c'], rim: '#c48aff' },
];
const W0 = 200, H0 = 170;

/** Island height for a given width, for layout. */
export const miniHeight = (width: number) => width * H0 / W0;
/** Vertical position of the island's top-surface centre, where the level medallion sits. */
export const miniCenter = (width: number) => width * 62 / W0;

function Props({ chapter, lit }: { chapter: number; lit: boolean }) {
  switch (chapter) {
    case 0: return <G>
      {/* Little temple: steps, columns and a pediment */}
      <Polygon points="26,52 64,52 60,47 30,47" fill="#f1e2c6" />
      {[32, 40, 48, 56].map(x => <Rect key={x} x={x} y={30} width={3.4} height={17} fill="#f6ecd8" />)}
      <Polygon points="28,30 62,30 45,21" fill="#f1e2c6" stroke="#d8c4a0" strokeWidth={.8} />
      <Path d="M150 54 q-6 -14 4 -26 q8 12 -4 26z" fill="#3f8a3a" /><Path d="M164 58 q-5 -12 3 -22 q7 10 -3 22z" fill="#2f7a36" />
      <Ellipse cx={22} cy={104} rx={22} ry={7} fill="#ffffff" opacity={.95} />
      <Ellipse cx={182} cy={92} rx={18} ry={6} fill="#ffffff" opacity={.9} />
      <Path d="M138 74 q2 30 -2 60" stroke="#bfe8ff" strokeWidth={5} opacity={.8} fill="none" />
    </G>;
    case 1: return <G>
      {[[30, 56, 26], [48, 58, 20], [160, 58, 24], [176, 62, 18]].map(([x, y, h], i) =>
        <G key={i}><Rect x={x! - 1.6} y={y! - h! * .4} width={3.2} height={h! * .4} fill="#4a3a2a" />
          <Path d={`M${x! - h! * .45} ${y! - h! * .3} q${h! * .45} ${-h!} ${h! * .9} 0z`} fill={i % 2 ? '#2f8a3c' : '#3f9a3a'} /></G>)}
      <Path d="M64 80 q4 30 0 70" stroke="#3f9a3a" strokeWidth={2.2} fill="none" />
      <Path d="M136 82 q-4 26 2 56" stroke="#3f9a3a" strokeWidth={2.2} fill="none" />
      <Path d="M152 78 q3 30 -1 62" stroke="#cfefff" strokeWidth={6} opacity={.75} fill="none" />
      {[0, 1, 2, 3, 4, 5, 6].map(i => <Line key={i} x1={20 + i * 27} y1={4 + (i % 3) * 6} x2={16 + i * 27} y2={18 + (i % 3) * 6} stroke="#d8f6ff" strokeWidth={1.2} opacity={.6} />)}
    </G>;
    case 2: return <G>
      <Polygon points="20,56 44,24 68,56" fill="#e8c27a" /><Polygon points="44,24 68,56 54,56" fill="#c49a5e" />
      <Polygon points="150,54 158,20 166,54" fill="#e2b874" /><Polygon points="156,16 160,16 158,10" fill="#ffd56a" />
      <Path d="M176 58 q4 -18 0 -30" stroke="#8a6234" strokeWidth={2.4} fill="none" />
      <Path d="M176 28 q-12 -2 -16 6 M176 28 q12 -2 16 6 M176 28 q-6 -8 -14 -8 M176 28 q6 -8 14 -8" stroke="#3f9a3a" strokeWidth={3} fill="none" strokeLinecap="round" />
      <Circle cx={182} cy={14} r={9} fill="#fff1c0" opacity={.85} />
    </G>;
    case 3: return <G>
      {[[34, 50, 22], [44, 54, 14], [164, 50, 26], [174, 56, 16]].map(([x, y, h], i) =>
        <Polygon key={i} points={`${x! - 5},${y} ${x! + 5},${y} ${x},${y! - h!}`} fill={i % 2 ? '#bfeaff' : '#e8f8ff'} stroke="#7fc8f0" strokeWidth={.6} />)}
      {[0, 1, 2, 3, 4, 5].map(i => <Circle key={i} cx={20 + i * 33} cy={6 + (i * 7) % 16} r={1.6} fill="#fff" />)}
      <Path d="M10 12 q40 -10 80 4 t90 -6" stroke="#5affd0" strokeWidth={5} opacity={.35} fill="none" />
    </G>;
    default: return <G>
      {[[40, 52, 16, '#c45aff'], [54, 56, 10, '#ff4fd8'], [160, 52, 18, '#ff4fd8'], [172, 58, 11, '#c45aff']].map(([x, y, h, c], i) =>
        <Polygon key={i} points={`${x as number - 4},${y} ${x as number + 4},${y} ${x},${(y as number) - (h as number)}`} fill={c as string} opacity={.95} />)}
      <Ellipse cx={100} cy={110} rx={96} ry={16} fill="none" stroke="#8a5aff" strokeWidth={2} opacity={.5} />
      <Circle cx={14} cy={128} r={6} fill="#3a3048" /><Circle cx={190} cy={70} r={4} fill="#3a3048" />
      {[0, 1, 2, 3].map(i => <Circle key={i} cx={20 + i * 55} cy={10 + (i % 2) * 12} r={1.2} fill="#fff" />)}
    </G>;
  }
}

/**
 * A small floating island in its world's style: the same scenery for every level in a chapter, lit and glowing once
 * the level is cleared and dimmed while it is still locked.
 */
export const MiniBoard = memo(function MiniBoard({ chapter, state, width }: { chapter: number; state: MiniState; width: number }) {
  const look = looks[chapter]!;
  const p = isles[chapter]!;
  const id = `isle${chapter}${state}`;
  const lit = state === 'done';
  const L = 52, R = 148, T = 40, B = 84, D = 12;
  // Tile surface, drawn as a gentle trapezoid so it reads like the tilted game board.
  const tl = [L + 6, T], tr = [R - 6, T], br = [R, B], bl = [L, B];
  const grid: string[] = [];
  for (let k = 1; k < 4; k++) {
    const f = k / 4;
    grid.push(`M${tl[0]! + (tr[0]! - tl[0]!) * f} ${T} L${bl[0]! + (br[0]! - bl[0]!) * f} ${B}`);
    grid.push(`M${tl[0]! + (bl[0]! - tl[0]!) * f} ${T + (B - T) * f} L${tr[0]! + (br[0]! - tr[0]!) * f} ${T + (B - T) * f}`);
  }
  const under = chapter === 2
    ? `M${L - 4} ${B + D} L${R + 4} ${B + D} L${R - 2} ${B + D + 18} L${L + 2} ${B + D + 18} Z M${L + 10} ${B + D + 18} L${R - 10} ${B + D + 18} L${R - 18} ${B + D + 34} L${L + 18} ${B + D + 34} Z`
    : chapter === 1 ? `M${L - 6} ${B + D} L${R + 6} ${B + D} Q${R} ${B + 60} 100 ${H0 - 6} Q${L} ${B + 60} ${L - 6} ${B + D} Z`
    : chapter === 3 ? `M${L - 6} ${B + D} L${R + 6} ${B + D} L${R - 8} ${B + 30} L112 ${B + 40} L100 ${H0 - 4} L88 ${B + 40} L${L + 8} ${B + 30} Z`
    : `M${L - 8} ${B + D} L${R + 8} ${B + D} L${R - 2} ${B + 34} L122 ${B + 46} L104 ${H0 - 4} L86 ${B + 52} L66 ${B + 40} L${L + 2} ${B + 30} Z`;
  return <Svg width={width} height={miniHeight(width)} viewBox={`0 0 ${W0} ${H0}`} opacity={state === 'locked' ? .55 : 1}>
    <Defs>
      <SvgGradient id={`${id}t`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={p.top[0]} /><Stop offset="1" stopColor={p.top[1]} /></SvgGradient>
      <SvgGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={p.side[0]} /><Stop offset="1" stopColor={p.side[1]} /></SvgGradient>
      <SvgGradient id={`${id}r`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={p.rock[0]} /><Stop offset="1" stopColor={p.rock[1]} stopOpacity={chapter === 2 ? 1 : .25} /></SvgGradient>
      <RadialGradient id={`${id}g`} cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor={look.crystal} stopOpacity=".75" /><Stop offset="1" stopColor={look.crystal} stopOpacity="0" /></RadialGradient>
    </Defs>
    {lit && <Ellipse cx={100} cy={70} rx={98} ry={56} fill={`url(#${id}g)`} />}
    <Path d={under} fill={`url(#${id}r)`} />
    {/* Wide grassy / sandy / snowy shelf the board sits on */}
    <Ellipse cx={100} cy={B + 6} rx={88} ry={22} fill={p.rim} opacity={chapter === 4 ? .25 : .95} />
    <Ellipse cx={100} cy={B + 2} rx={84} ry={20} fill={p.top[1]} />
    <Props chapter={chapter} lit={lit} />
    <Polygon points={`${bl.join(',')} ${br.join(',')} ${R},${B + D} ${L},${B + D}`} fill={`url(#${id}s)`} />
    <Polygon points={`${tl.join(',')} ${tr.join(',')} ${br.join(',')} ${bl.join(',')}`} fill={`url(#${id}t)`} stroke={p.rim} strokeWidth={1.6} />
    <Path d={grid.join(' ')} stroke={p.grid} strokeWidth={chapter === 4 ? 1 : .8} opacity={chapter === 4 ? .9 : .7} />
    {lit && <G>
      <Line x1={L + 14} y1={B - 8} x2={100} y2={T + 12} stroke={look.beam} strokeWidth={5} strokeOpacity={.45} strokeLinecap="round" />
      <Line x1={L + 14} y1={B - 8} x2={100} y2={T + 12} stroke={look.beamGlow} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={100} y1={T + 12} x2={R - 16} y2={B - 10} stroke={look.beam} strokeWidth={5} strokeOpacity={.45} strokeLinecap="round" />
      <Line x1={100} y1={T + 12} x2={R - 16} y2={B - 10} stroke={look.beamGlow} strokeWidth={1.8} strokeLinecap="round" />
    </G>}
    <Polygon points={`${R - 16},${B - 22} ${R - 10},${B - 12} ${R - 16},${B - 6} ${R - 22},${B - 12}`} fill={lit ? look.crystal : '#5a6078'} stroke="#ffffffaa" strokeWidth={.8} />
  </Svg>;
});
