import React, { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, CatmullRomCurve3, Color, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Sprite, SpriteMaterial, TubeGeometry, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { useFrame } from './Canvas';
import { gemGeometry, glassMaterial, glowTexture, heartGeometry, portalMaterial, shardGeometry, sparkTexture } from './fx';
import { useAppear } from './Board';
import { Look } from './look';
import { Direction, Mirror, Orientation, Point } from '../game/types';
import { audio } from '../services/audio';

const frameGeo = new RoundedBoxGeometry(.9, 1.06, .16, 3, .06);
const blockGeo = new RoundedBoxGeometry(.9, .95, .9, 3, .1);
const iceGeo = new RoundedBoxGeometry(1, 1.4, 1, 2, .12);
import type { BeamClock } from './Beam';

function Glow({ color, scale = 1, opacity = 1, position = [0, 0, 0], spark = false }: { color: string; scale?: number; opacity?: number; position?: [number, number, number]; spark?: boolean }) {
  return <sprite position={position} scale={[scale, scale, 1]} renderOrder={6}>
    <spriteMaterial map={spark ? sparkTexture : glowTexture} color={color} opacity={opacity} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
  </sprite>;
}

/** A short pooled burst of sprites, restarted whenever `trigger` changes. */
function Burst({ trigger, color, count = 8, spread = .8, rise = .6, size = .35, y = .2, duration = .7 }: {
  trigger: number; color: string; count?: number; spread?: number; rise?: number; size?: number; y?: number; duration?: number;
}) {
  const group = useRef<Group>(null);
  const start = useRef(-10);
  const last = useRef(trigger);
  const dirs = useMemo(() => Array.from({ length: count }, (_, i) => ({ a: (i / count) * Math.PI * 2 + i, s: .6 + (i % 3) * .25 })), [count]);
  useFrame(({ clock }) => {
    if (last.current !== trigger) { last.current = trigger; start.current = clock.elapsedTime; }
    const age = (clock.elapsedTime - start.current) / duration;
    const g = group.current;
    if (!g) return;
    g.visible = age < 1;
    if (age >= 1) return;
    g.children.forEach((c, i) => {
      const d = dirs[i]!;
      c.position.set(Math.cos(d.a) * spread * age * d.s, y + rise * age * d.s, Math.sin(d.a) * spread * age * d.s);
      const s = size * (1 - age * .6) * (age < .1 ? age * 10 : 1);
      c.scale.set(s, s, 1);
      ((c as Sprite).material as SpriteMaterial).opacity = 1 - age;
    });
  });
  return <group ref={group} visible={false}>
    {dirs.map((_, i) => <sprite key={i} renderOrder={7}><spriteMaterial map={glowTexture} color={color} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} /></sprite>)}
  </group>;
}

const dustColors = ['#f3dcc0', '#bfe8ff', '#ffd89a', '#ffffff', '#7ae8ff'];

export const MirrorPiece = React.memo(function MirrorPiece({ mirror, orientation, thawed, hint, hitAt, clock, look, chapter, delay, onTap, onBlocked, sounds }: {
  mirror: Mirror; orientation: Orientation; thawed: boolean; hint: boolean; hitAt?: number; clock: BeamClock; look: Look; chapter: number;
  delay: number; onTap?: () => void; onBlocked?: () => void; sounds: boolean;
}) {
  const root = useRef<Group>(null);
  const panel = useRef<Group>(null);
  const ring = useRef<Group>(null);
  const ice = useRef<Mesh>(null);
  const glow = useRef<Sprite>(null);
  const appear = useAppear(delay);
  const spring = useRef({ angle: orientation * Math.PI / 2 + Math.PI / 4, target: orientation * Math.PI / 2 + Math.PI / 4, vel: 0 });
  const last = useRef(orientation);
  const wobble = useRef(0);
  const melt = useRef(mirror.frozen && !thawed ? 1 : 0);
  const wasThawed = useRef(thawed);
  if (last.current !== orientation) { spring.current.target += Math.PI / 2; last.current = orientation; }
  useEffect(() => {
    if (mirror.frozen && thawed && !wasThawed.current && sounds) { audio.play('thaw'); audio.haptic('heavy'); }
    wasThawed.current = thawed;
  }, [thawed, mirror.frozen, sounds]);
  const frozenNow = !!mirror.frozen && !thawed;
  useFrame(({ clock: c }, dt) => {
    const t = c.elapsedTime;
    const s = spring.current;
    const step = Math.min(dt, 1 / 30);
    s.vel += ((s.target - s.angle) * 220 - s.vel * 17) * step;
    s.angle += s.vel * step;
    if (panel.current) panel.current.rotation.y = s.angle;
    wobble.current = Math.max(0, wobble.current - dt * 2.5);
    const a = appear(t);
    if (root.current) { root.current.scale.setScalar(Math.max(.001, a)); root.current.rotation.z = Math.sin(t * 40) * wobble.current * .08; }
    if (ring.current) { ring.current.rotation.y = -t * 1.2; ring.current.visible = !mirror.fixed && !frozenNow; }
    melt.current += ((frozenNow ? 1 : 0) - melt.current) * Math.min(1, dt * 3);
    if (ice.current) { ice.current.visible = melt.current > .02; ice.current.scale.set(1, melt.current, 1); }
    const lit = hitAt !== undefined && clock.reveal.value >= hitAt;
    if (glow.current) {
      const target = lit ? .9 + Math.sin(t * 12) * .1 : 0;
      glow.current.material.opacity += (target - glow.current.material.opacity) * Math.min(1, dt * 10);
    }
  });
  const frameMat = mirror.fixed ? { color: '#c9d4e6', metalness: .9, roughness: .25 } : { color: look.frame, metalness: 1, roughness: .28, emissive: '#3a2200', emissiveIntensity: .25 };
  return <group>
    <group ref={root}>
      <mesh position={[0, .07, 0]} castShadow receiveShadow><cylinderGeometry args={[.4, .45, .14, 24]} />
        <meshStandardMaterial color={mirror.fixed ? '#7d8598' : chapter === 4 ? '#3a4058' : '#a8602c'} metalness={.6} roughness={.4} /></mesh>
      <mesh position={[0, .15, 0]}><cylinderGeometry args={[.33, .36, .05, 24]} /><meshStandardMaterial color={look.frame} metalness={1} roughness={.3} /></mesh>
      <group ref={panel} position={[0, .72, 0]}>
        <mesh geometry={frameGeo} castShadow dispose={null}><meshStandardMaterial {...frameMat} /></mesh>
        <mesh position={[0, 0, .083]} material={glassMaterial}><planeGeometry args={[.72, .88]} /></mesh>
        <mesh position={[0, 0, -.083]} rotation={[0, Math.PI, 0]} material={glassMaterial}><planeGeometry args={[.72, .88]} /></mesh>
        {[[-.39, -.47], [-.39, .47], [.39, -.47], [.39, .47]].map(([x, y], i) =>
          <mesh key={i} position={[x!, y!, 0]}><sphereGeometry args={[.065, 10, 8]} /><meshStandardMaterial color={mirror.fixed ? '#9fb3d4' : '#fff1a8'} metalness={1} roughness={.2} /></mesh>)}
        <sprite ref={glow} scale={[1.6, 1.6, 1]} renderOrder={6}>
          <spriteMaterial map={glowTexture} color="#bff6ff" opacity={0} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
        </sprite>
      </group>
      {mirror.frozen && <mesh ref={ice} geometry={iceGeo} position={[0, .7, 0]} dispose={null}>
        <meshStandardMaterial color="#cfefff" roughness={.05} metalness={.1} transparent opacity={.55} envMapIntensity={2.2} emissive="#3aa8d8" emissiveIntensity={.25} />
      </mesh>}
    </group>
    <group ref={ring} position={[0, .03, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.5, .58, 40, 1, 0, Math.PI * 1.55]} />
        <meshBasicMaterial color={hint ? '#9dff7a' : '#7fe8ff'} transparent opacity={.85} toneMapped={false} side={2} /></mesh>
      <mesh position={[.54, 0, -.02]} rotation={[-Math.PI / 2, 0, Math.PI]}><circleGeometry args={[.13, 3]} />
        <meshBasicMaterial color={hint ? '#9dff7a' : '#7fe8ff'} toneMapped={false} side={2} /></mesh>
    </group>
    <Burst trigger={orientation} color={dustColors[chapter]!} count={9} spread={.9} rise={.35} size={.42} y={.12} />
    {mirror.frozen && <Burst trigger={thawed ? 1 : 0} color="#e8fbff" count={12} spread={.7} rise={1.6} size={.55} y={.5} duration={1.2} />}
    {hint && <HintArrow />}
    {onTap && <mesh position={[0, .75, 0]} visible={false}
      onClick={e => { e.stopPropagation(); if (mirror.fixed || frozenNow) { wobble.current = 1; onBlocked?.(); } else onTap(); }}>
      <boxGeometry args={[1, 1.7, 1]} /><meshBasicMaterial />
    </mesh>}
  </group>;
});

export const HintArrow = React.memo(function HintArrow() {
  const ref = useRef<Group>(null);
  const pulse = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ref.current) { ref.current.position.y = 1.6 + Math.sin(t * 5) * .12; ref.current.rotation.y = t * 2; }
    if (pulse.current) { const k = (t * 1.4) % 1; pulse.current.scale.set(1 + k * .9, 1 + k * .9, 1); (pulse.current.material as MeshBasicMaterial).opacity = .9 * (1 - k); }
  });
  return <>
    <group ref={ref} position={[0, 1.6, .3]} scale={1.1}>
      <mesh rotation={[Math.PI, 0, 0]}><coneGeometry args={[.24, .36, 4]} /><meshStandardMaterial color="#9dff7a" emissive="#3fd01a" emissiveIntensity={1} /></mesh>
      <mesh position={[0, .32, 0]}><boxGeometry args={[.14, .34, .14]} /><meshStandardMaterial color="#9dff7a" emissive="#3fd01a" emissiveIntensity={1} /></mesh>
      <Glow color="#9dff7a" scale={1.3} opacity={.7} />
    </group>
    <mesh ref={pulse} position={[0, .05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[.55, .7, 40]} /><meshBasicMaterial color="#9dff7a" transparent opacity={.9} depthWrite={false} toneMapped={false} />
    </mesh>
  </>;
});

const blockLooks = [
  { color: '#a9a7b5', top: '#5fa64a' }, { color: '#5d6a5a', top: '#3f8a36' }, { color: '#d4ae78', top: '#e8c58c' },
  { color: '#7fb8e0', top: '#ffffff' }, { color: '#2e3346', top: '#5ae0ff' },
];
export const BlockerPiece = React.memo(function BlockerPiece({ chapter, delay }: { chapter: number; delay: number }) {
  const root = useRef<Group>(null);
  const appear = useAppear(delay);
  useFrame(({ clock }) => { if (root.current) root.current.scale.setScalar(Math.max(.001, appear(clock.elapsedTime))); });
  const l = blockLooks[chapter]!;
  const ice = chapter === 3, metal = chapter === 4;
  return <group ref={root}><group position={[0, .47, 0]}>
    <mesh geometry={blockGeo} castShadow receiveShadow dispose={null}>
      <meshStandardMaterial color={l.color} roughness={ice ? .05 : metal ? .3 : .95} metalness={metal ? .8 : 0} transparent={ice} opacity={ice ? .8 : 1} envMapIntensity={ice ? 2 : 1} />
    </mesh>
    {metal ? <mesh position={[0, 0, .456]}><boxGeometry args={[.7, .06, .01]} /><meshBasicMaterial color={l.top} toneMapped={false} /></mesh>
      : <mesh position={[0, .47, 0]} scale={[.42, .08, .4]}><icosahedronGeometry args={[1, 1]} /><meshStandardMaterial color={l.top} flatShading roughness={.9} /></mesh>}
    {chapter === 2 && [[-.2, .1], [.15, -.12], [0, .25]].map(([x, y], i) => <mesh key={i} position={[x!, y!, .456]}><boxGeometry args={[.16, .04, .01]} /><meshStandardMaterial color="#8a5a2a" /></mesh>)}
  </group></group>;
});

export const SplitterPiece = React.memo(function SplitterPiece({ hitAt, clock, delay }: { hitAt?: number; clock: BeamClock; delay: number }) {
  const prism = useRef<Group>(null);
  const glow = useRef<Sprite>(null);
  const root = useRef<Group>(null);
  const appear = useAppear(delay);
  useFrame(({ clock: c }, dt) => {
    const t = c.elapsedTime;
    if (prism.current) { prism.current.rotation.y = t * .6; prism.current.position.y = .85 + Math.sin(t * 1.6) * .05; }
    if (root.current) root.current.scale.setScalar(Math.max(.001, appear(t)));
    const lit = hitAt !== undefined && clock.reveal.value >= hitAt;
    if (glow.current) { const target = lit ? 1 : .25; glow.current.material.opacity += (target - glow.current.material.opacity) * Math.min(1, dt * 8); }
  });
  return <group ref={root}>
    <mesh position={[0, .12, 0]} castShadow><cylinderGeometry args={[.42, .46, .24, 6]} /><meshStandardMaterial color="#e8b04a" metalness={1} roughness={.3} /></mesh>
    <group ref={prism} position={[0, .85, 0]}>
      <mesh castShadow><cylinderGeometry args={[.42, .42, 1, 3]} />
        <meshStandardMaterial color="#fff6e0" roughness={.02} metalness={.2} transparent opacity={.75} envMapIntensity={2.5} emissive="#ffb84a" emissiveIntensity={.35} /></mesh>
      <sprite ref={glow} scale={[2, 2, 1]} renderOrder={6}><spriteMaterial map={sparkTexture} color="#ffe6a0" opacity={.25} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} /></sprite>
      <Glow color="#7affd8" scale={.6} position={[.25, 0, 0]} opacity={.5} />
      <Glow color="#ff7ad8" scale={.6} position={[-.25, 0, 0]} opacity={.5} />
    </group>
  </group>;
});

export const PortalPiece = React.memo(function PortalPiece({ delay, exit }: { delay: number; exit?: boolean }) {
  const ring = useRef<Mesh>(null);
  const root = useRef<Group>(null);
  const appear = useAppear(delay);
  useFrame(({ clock }) => {
    if (ring.current) ring.current.rotation.z = clock.elapsedTime * (exit ? -1 : 1);
    if (root.current) root.current.scale.setScalar(Math.max(.001, appear(clock.elapsedTime)));
  });
  return <group ref={root}>
    <mesh position={[0, .07, 0]}><cylinderGeometry args={[.38, .44, .14, 24]} /><meshStandardMaterial color="#3a3f58" metalness={.9} roughness={.3} /></mesh>
    <group position={[0, .72, 0]} rotation={[0, Math.PI / 4, 0]}>
      <mesh ref={ring}><torusGeometry args={[.42, .07, 12, 40]} /><meshStandardMaterial color="#d8b8ff" emissive="#8a3cff" emissiveIntensity={1.6} metalness={.6} roughness={.2} /></mesh>
      <mesh material={portalMaterial}><circleGeometry args={[.4, 40]} /></mesh>
      <Glow color="#b07aff" scale={2} opacity={.7} />
    </group>
  </group>;
});

const linkColors = ['#7aff6a', '#7aff6a', '#ffd34a', '#9ff0ff', '#5ae0ff'];
export const LinkVine = React.memo(function LinkVine({ a, b, chapter, pulse }: { a: Point; b: Point; chapter: number; pulse: number }) {
  const mat = useRef<MeshStandardMaterial>(null);
  const start = useRef(-10);
  const last = useRef(pulse);
  const geometry = useMemo(() => {
    const mid = new Vector3((a[0] + b[0]) / 2, 1.9 + Math.hypot(a[0] - b[0], a[1] - b[1]) * .18, (a[1] + b[1]) / 2);
    const curve = new CatmullRomCurve3([new Vector3(a[0], 1.35, a[1]), mid, new Vector3(b[0], 1.35, b[1])]);
    return new TubeGeometry(curve, 32, .05, 6, false);
  }, [a, b]);
  useFrame(({ clock }) => {
    if (last.current !== pulse) { last.current = pulse; start.current = clock.elapsedTime; }
    const age = clock.elapsedTime - start.current;
    if (mat.current) mat.current.emissiveIntensity = .6 + Math.sin(clock.elapsedTime * 3) * .2 + Math.max(0, 2.5 - age * 5);
  });
  const color = linkColors[chapter]!;
  return <mesh geometry={geometry}><meshStandardMaterial ref={mat} color={color} emissive={color} emissiveIntensity={.6} roughness={.6} toneMapped={false} /></mesh>;
});
const curseTint = ['#ff3a6a', '#ff4a3a', '#ff2a2a', '#c43aff', '#ff2ad0'];
/** A cursed shadow gem: drinks any light that touches it, and the level cannot be won while it feeds. */
export const CursedGem = React.memo(function CursedGem({ hitAt, clock, chapter, delay, sounds }: { hitAt?: number; clock: BeamClock; chapter: number; delay: number; sounds: boolean }) {
  const root = useRef<Group>(null);
  const gem = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const flare = useRef<Sprite>(null);
  const core = useRef<MeshStandardMaterial>(null);
  const motes = useRef<Group>(null);
  const appear = useAppear(delay);
  const heat = useRef(0);
  const wasLit = useRef(false);
  const tint = curseTint[chapter]!;
  useFrame(({ clock: c }, dt) => {
    const t = c.elapsedTime;
    const lit = hitAt !== undefined && clock.reveal.value >= hitAt;
    if (lit && !wasLit.current && sounds) { audio.play('curse', .8); audio.haptic('error'); }
    wasLit.current = lit;
    heat.current += ((lit ? 1 : 0) - heat.current) * Math.min(1, dt * 6);
    const h = heat.current;
    if (root.current) root.current.scale.setScalar(Math.max(.001, appear(t)));
    if (gem.current) {
      gem.current.rotation.y = t * (.5 + h * 3);
      gem.current.position.set(Math.sin(t * 47) * .03 * h, .78 + Math.sin(t * 1.3) * .06, Math.cos(t * 53) * .03 * h);
    }
    if (core.current) core.current.emissiveIntensity = .5 + Math.sin(t * 2.2) * .25 + h * (2.6 + Math.sin(t * 18) * .8);
    if (flare.current) { const s = .6 + h * (1.8 + Math.sin(t * 14) * .3); flare.current.scale.set(s, s, 1); flare.current.material.opacity = .25 + h * .75; }
    if (ring.current) {
      const k = (t * 1.6) % 1;
      ring.current.visible = h > .05;
      ring.current.scale.set(1 + k * .8, 1 + k * .8, 1);
      (ring.current.material as MeshBasicMaterial).opacity = (1 - k) * h;
    }
    if (motes.current) motes.current.rotation.y = -t * (.8 + h * 4);
  });
  return <group ref={root}>
    <mesh position={[0, .07, 0]} castShadow receiveShadow><cylinderGeometry args={[.36, .44, .14, 7]} /><meshStandardMaterial color="#1a1420" roughness={.6} metalness={.4} /></mesh>
    {[0, 1, 2, 3, 4, 5, 6].map(i => <mesh key={i} position={[Math.cos(i * .9) * .38, .2, Math.sin(i * .9) * .38]} rotation={[Math.sin(i) * .4, i, Math.cos(i) * .4]} scale={[.06, .18, .06]}>
      <octahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#120c18" roughness={.2} metalness={.6} flatShading /></mesh>)}
    <group ref={gem} position={[0, .78, 0]}>
      <mesh scale={[.3, .52, .3]} castShadow><octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial ref={core} color="#16081c" emissive={tint} emissiveIntensity={.6} roughness={.15} metalness={.5} flatShading /></mesh>
      {[-1, 1].map(s => <mesh key={s} position={[s * .2, -.12, 0]} rotation={[0, 0, -s * .6]} scale={[.12, .3, .12]}><octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#0e0812" emissive={tint} emissiveIntensity={.4} roughness={.2} metalness={.5} flatShading /></mesh>)}
      <sprite ref={flare} renderOrder={6}><spriteMaterial map={sparkTexture} color={tint} opacity={.25} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} /></sprite>
    </group>
    <group ref={motes} position={[0, .7, 0]}>
      {[0, 1, 2, 3].map(i => <mesh key={i} position={[Math.cos(i * 1.57) * .5, Math.sin(i * 2.3) * .2, Math.sin(i * 1.57) * .5]}>
        <sphereGeometry args={[.035, 6, 5]} /><meshBasicMaterial color={tint} toneMapped={false} /></mesh>)}
    </group>
    <mesh ref={ring} position={[0, .04, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[.5, .62, 40]} /><meshBasicMaterial color={tint} transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>
  </group>;
});