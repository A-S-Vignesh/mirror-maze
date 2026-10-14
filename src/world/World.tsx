import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { AdditiveBlending, CatmullRomCurve3, Color, DirectionalLight, Group, HemisphereLight, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  PerspectiveCamera, PMREMGenerator, Scene, SphereGeometry, Sprite, Vector3 } from 'three';
import { Canvas, useFrame, useThree } from './Canvas';
import { SceneBoundary } from './SceneBoundary';
import { looks, Look } from './look';
import { BoardBody, BoardClock } from './Board';
import { BlockerPiece, CursedGem, HintArrow, LinkVine, MirrorPiece, PortalPiece, SplitterPiece } from './Entities';
import { Beam, BeamClock } from './Beam';
import { CHARGE_TIME, CrystalPiece, WinClock } from './Crystal';
import { LightSource } from './Sources';
import { Amulet } from './Amulet';
import { gemGeometry, glowTexture, heartGeometry, skyMaterial } from './fx';
import { ShaderClock, SkyDome } from './env/common';
import { SkyTemples } from './env/Sky';
import { Rainforest, Storm } from './env/Rainforest';
import { Desert } from './env/Desert';
import { IceAge } from './env/IceAge';
import { EyeState, TheVoid } from './env/Void';
import { PerformanceStats } from './PerformanceStats';
import { clipToCrystals, key } from '../game/engine';
import { Level, PlayState, Trace } from '../game/types';
import { chapters } from '../game/chapters';

export type WorldMode = 'splash' | 'menu' | 'map' | 'prologue' | 'intro' | 'game' | 'complete' | 'fail' | 'outro' | 'forge' | 'ending';
/** Scroll position of the journey map, written by the map screen and read every frame without re-rendering. */
export interface MapScroll { progress: number }
export interface WorldProps {
  chapter: number; mode: WorldMode; level: Level; state: PlayState; trace: Trace; boardKey: string;
  hint?: string; onTap?: (id: string) => void; onBlocked?: () => void;
  /** Screen pixels reserved by the HUD above and below the board. */
  insets: { top: number; bottom: number }; dusk?: number;
  hearts: number[]; forging?: number; mapScroll?: MapScroll;
  /** Play camera: cinematic tilt or near top-down. */
  view?: 'tilt' | 'top';
}

const sunsetColor = new Color('#ff6a3a');
const environmentTargets = new WeakMap<object, Map<Look, ReturnType<PMREMGenerator['fromScene']>>>();
const environmentGenerators = new WeakMap<object, PMREMGenerator>();

function EnvMap({ look }: { look: Look }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const cached = environmentTargets.get(gl)?.get(look);
    if (cached) {
      scene.environment = cached.texture;
      if (__DEV__ && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mirror-maze-performance', { detail: { type: 'pmrem', chapter: looks.indexOf(look), cached: true } }));
      }
      return () => { if (scene.environment === cached.texture) scene.environment = null; };
    }
    let dispose = () => undefined as void;
    let pm: PMREMGenerator | undefined;
    let ownsGenerator = false;
    let target: ReturnType<PMREMGenerator['fromScene']> | undefined;
    let sky: ReturnType<typeof skyMaterial> | undefined;
    let skyGeometry: SphereGeometry | undefined;
    let sunGeometry: SphereGeometry | undefined;
    let sunMaterial: MeshBasicMaterial | undefined;
    const startedAt = performance.now();
    try {
      pm = environmentGenerators.get(gl);
      if (!pm) {
        pm = new PMREMGenerator(gl);
        environmentGenerators.set(gl, pm);
        ownsGenerator = true;
      }
      const s = new Scene();
      sky = skyMaterial();
      skyGeometry = new SphereGeometry(10, 32, 16);
      sunGeometry = new SphereGeometry(1.4, 12, 8);
      sunMaterial = new MeshBasicMaterial({ color: new Color(look.sky.sun).multiplyScalar(4) });
      const u = sky.uniforms;
      u.uTop!.value.set(look.sky.top); u.uHorizon!.value.set(look.sky.horizon); u.uBottom!.value.set(look.sky.bottom);
      u.uSun!.value.set(look.sky.sun); u.uSunDir!.value.set(...look.sky.sunDir).normalize(); u.uSunSize!.value = look.sky.sunSize;
      u.uNebula!.value = look.sky.nebula;
      s.add(new Mesh(skyGeometry, sky));
      const sun = new Mesh(sunGeometry, sunMaterial);
      sun.position.set(...look.sky.sunDir).normalize().multiplyScalar(8);
      s.add(sun);
      target = pm.fromScene(s, .03);
      scene.environment = target.texture;
      let targets = environmentTargets.get(gl);
      if (!targets) { targets = new Map(); environmentTargets.set(gl, targets); }
      targets.set(look, target);
      if (__DEV__) {
        const sample = { type: 'pmrem', chapter: looks.indexOf(look), ms: Math.round(performance.now() - startedAt), cached: false };
        console.info('[Mirror Maze perf] PMREM generated', sample);
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('mirror-maze-performance', { detail: sample }));
      }
      dispose = () => {
        if (scene.environment === target?.texture) scene.environment = null;
        sky?.dispose(); skyGeometry?.dispose(); sunGeometry?.dispose(); sunMaterial?.dispose();
      };
    } catch (cause) {
      target?.dispose();
      if (ownsGenerator) { pm?.dispose(); environmentGenerators.delete(gl); }
      sky?.dispose(); skyGeometry?.dispose(); sunGeometry?.dispose(); sunMaterial?.dispose();
      console.warn('Environment reflections unavailable', cause);
    }
    return () => dispose();
  }, [gl, scene, look]);
  return null;
}

function Lights({ look, storm, dusk = 0 }: { look: Look; storm?: Storm; dusk?: number }) {
  const sun = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const fade = useRef(0);
  const { scene } = useThree();
  const fogBase = useMemo(() => new Color(look.fog.color), [look.fog.color]);
  const fogDusk = useMemo(() => new Color('#5a2a3a'), []);
  useFrame((_, dt) => {
    fade.current += (dusk - fade.current) * Math.min(1, dt * 1.5);
    const f = storm?.flash.value ?? 0;
    const d = fade.current;
    if (sun.current) { sun.current.intensity = (look.light.sunIntensity + f * 6) * (1 - d * .55); sun.current.color.set(look.light.sun).lerp(sunsetColor, d * .6); }
    if (hemi.current) hemi.current.intensity = (look.light.hemi + f * 2) * (1 - d * .45);
    if (scene.fog && 'color' in scene.fog) scene.fog.color.copy(fogBase).lerp(fogDusk, d * .7);
  });
  const d = look.sky.sunDir;
  const n = Math.hypot(...d);
  return <>
    <hemisphereLight ref={hemi} args={[look.light.sky, look.light.ground, look.light.hemi]} />
    <directionalLight ref={sun} position={[d[0] / n * 14 + 2, Math.max(.45, d[1] / n) * 14 + 6, d[2] / n * 14 + 6]} color={look.light.sun}
      intensity={look.light.sunIntensity} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-.0012} shadow-normalBias={.02}
      shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} shadow-camera-near={1} shadow-camera-far={60} />
    <directionalLight position={[-8, 4, -6]} color={look.light.fill} intensity={look.light.fillIntensity} />
  </>;
}


const boardModes: WorldMode[] = ['intro', 'game', 'complete', 'fail', 'outro'];

function BoardView({ level, state, trace, look, chapter, hint, onTap, onBlocked, sounds }: {
  level: Level; state: PlayState; trace: Trace; look: Look; chapter: number; hint?: string; onTap?: (id: string) => void; onBlocked?: () => void; sounds: boolean;
}) {
  const clock = useMemo<BeamClock>(() => ({ reveal: { value: 0 }, boost: { value: 0 } }), []);
  const win = useMemo<WinClock>(() => ({ start: -1 }), []);
  const born = useMemo(() => ({ value: -1 }), []);
  const boardClock = useMemo(() => ({ born }), [born]);
  const shown = useMemo(() => (trace.won ? clipToCrystals(trace) : trace), [trace]);
  const finish = useMemo(() => Math.max(0, ...Object.values(trace.activatedAt)), [trace]);
  useFrame(({ clock: c }) => {
    const t = c.elapsedTime;
    if (born.value < 0) born.value = t;
    if (trace.won && win.start < 0 && clock.reveal.value >= finish - .01) win.start = t;
    const age = win.start < 0 ? -1 : t - win.start;
    clock.boost.value = age < 0 ? 0 : age < CHARGE_TIME ? (age / CHARGE_TIME) * 1.4 : Math.max(.35, 1.4 - (age - CHARGE_TIME) * 1.5);
  });
  const n = level.size, c0 = (n - 1) / 2;
  const delay = (p: readonly [number, number]) => .3 + Math.hypot(p[0] - c0, p[1] - c0) * .07;
  const hitAt = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of shown.hits) if ((h.kind === 'mirror' || h.kind === 'splitter' || h.kind === 'hazard') && !m.has(key(h.point))) m.set(key(h.point), h.at);
    return m;
  }, [shown]);
  const links = useMemo(() => {
    const groups = new Map<string, typeof level.mirrors>();
    for (const m of level.mirrors) if (m.link) groups.set(m.link, [...(groups.get(m.link) ?? []), m]);
    return [...groups.values()].filter(g => g.length > 1);
  }, [level]);
  const mirrorTaps = useMemo(() => onTap ? new Map(level.mirrors.map(m => [m.id, () => onTap(m.id)])) : undefined, [level, onTap]);
  const emitterTaps = useMemo(() => onTap ? new Map(level.emitters.filter(e => e.rotatable).map(e => [e.id, () => onTap(e.id)])) : undefined, [level, onTap]);
  const blockedTap = useCallback(() => onBlocked?.(), [onBlocked]);
  return <BoardClock.Provider value={boardClock}>
    <group position={[-c0, 0, -c0]}>
      <BoardBody size={n} chapter={chapter} look={look} />
      {level.emitters.map(e => <group key={e.id} position={[e.position[0], 0, e.position[1]]}>
        <LightSource direction={state.aims[e.id] ?? e.direction} chapter={chapter} look={look} fire={state} delay={.25} rotatable={e.rotatable}
          hint={hint === e.id} onTap={onTap ? e.rotatable ? emitterTaps?.get(e.id) : blockedTap : undefined} />
        {hint === e.id && <HintArrow />}
      </group>)}
      {level.hazards.map(h => <group key={h.id} position={[h.position[0], 0, h.position[1]]}>
        <CursedGem hitAt={hitAt.get(key(h.position))} clock={clock} chapter={chapter} delay={delay(h.position)} sounds={sounds} />
      </group>)}
      {level.mirrors.map(m => <group key={m.id} position={[m.position[0], 0, m.position[1]]}>
        <MirrorPiece mirror={m} orientation={state.orientations[m.id] ?? m.orientation} thawed={!!state.thawed[m.id]} hint={hint === m.id}
          hitAt={hitAt.get(key(m.position))} clock={clock} look={look} chapter={chapter} delay={delay(m.position)} sounds={sounds}
          onTap={mirrorTaps?.get(m.id)} onBlocked={onBlocked} />
      </group>)}
      {level.targets.map((t, i) => <group key={t.id} position={[t.position[0], 0, t.position[1]]}>
        <CrystalPiece at={trace.activatedAt[t.id]} clock={clock} win={win} index={i} look={look} chapter={chapter}
          heart={level.boss && t.id === `c${level.targets.length}`} delay={delay(t.position)} sounds={sounds} />
      </group>)}
      {level.blockers.map(p => <group key={key(p)} position={[p[0], 0, p[1]]}><BlockerPiece chapter={chapter} delay={delay(p)} /></group>)}
      {level.splitters.map(s => <group key={s.id} position={[s.position[0], 0, s.position[1]]}>
        <SplitterPiece hitAt={hitAt.get(key(s.position))} clock={clock} delay={delay(s.position)} />
      </group>)}
      {level.portals.flatMap(p => [p.position, p.exit].map((pt, i) => <group key={`${p.id}${i}`} position={[pt[0], 0, pt[1]]}>
        <PortalPiece delay={delay(pt)} exit={i === 1} />
      </group>))}
      {links.map(g => <LinkVine key={g[0]!.link} a={g[0]!.position} b={g[1]!.position} chapter={chapter} pulse={state.orientations[g[0]!.id] ?? 0} />)}
      <Beam trace={shown} look={look} clock={clock} sounds={sounds} />
    </group>
  </BoardClock.Provider>;
}

const vistas: { pos: [number, number, number]; target: [number, number, number] }[] = [
  { pos: [15, 7, 22], target: [-4, 6, -42] },
  { pos: [9, 3, 17], target: [6, 10, -40] },
  { pos: [16, 5, 24], target: [-10, 10, -120] },
  { pos: [12, 4, 22], target: [0, 26, -140] },
  { pos: [9, 4, 24], target: [0, 20, -120] },
];
const introPaths: [number, number, number][][] = [
  [[0, 60, 90], [-30, 20, 40], [-12, 6, 18], [6, 9, 14]],
  [[40, 4, 60], [18, -2, 30], [-6, 2, 18], [6, 9, 14]],
  [[-60, 30, -60], [-40, 10, 0], [-14, 5, 20], [6, 9, 14]],
  [[0, -4, 80], [20, 6, 40], [6, 12, 20], [6, 9, 14]],
  [[0, 30, -60], [30, 15, -10], [14, 8, 18], [6, 9, 14]],
];
const origin = new Vector3(0, 0, 0);
/** Open sky high above every world's scenery, where the Amulet is displayed. */
const ALTAR: [number, number, number] = [0, 30, 0];
const tmpPos = new Vector3(), tmpTarget = new Vector3(), corner = new Vector3();
const UP = new Vector3(0, 1, 0);
const GAME_DIR = new Vector3(.12, .82, .56).normalize();
/** Near top-down view for reading big boards; still slightly tilted so pieces keep their depth. */
const TOP_DIR = new Vector3(.04, .97, .24).normalize();

/**
 * Finds the camera distance and vertical offset that make the board fill the space between the HUD bars.
 * Projects the board's bounding corners, so the result is tight for any screen shape.
 */
function frameBoard(cam: PerspectiveCamera, n: number, W: number, H: number, top: number, bottom: number, dir: Vector3) {
  if (W <= 0 || H <= 0) return { d: n * 2.2 + 4, offset: 0 };
  const half = n / 2 + .1;
  const regionH = Math.max(120, H - top - bottom);
  let d = n * 2.2 + 4;
  cam.aspect = W / H;
  cam.clearViewOffset();
  cam.updateProjectionMatrix();
  let minY = 0, maxY = 0;
  for (let iter = 0; iter < 4; iter++) {
    cam.position.copy(dir).multiplyScalar(d);
    cam.lookAt(origin);
    cam.updateMatrixWorld();
    let minX = 1e9, maxX = -1e9;
    minY = 1e9; maxY = -1e9;
    for (const x of [-half, half]) for (const z of [-half, half]) for (const y of [-.7, 1.7]) {
      corner.set(x, y, z).project(cam);
      minX = Math.min(minX, corner.x); maxX = Math.max(maxX, corner.x);
      minY = Math.min(minY, corner.y); maxY = Math.max(maxY, corner.y);
    }
    // A little margin so the idle drift and tap punches never push the board under the HUD.
    const needX = (maxX - minX) / 2 / .95;
    const needY = (maxY - minY) / 2 / (regionH / H * .95);
    d *= Math.max(needX, needY);
  }
  // Pixel shift that puts the board's projected centre in the middle of the free region.
  const centerPx = (1 - (minY + maxY) / 2) / 2 * H;
  const regionCenter = top + regionH / 2;
  return { d, offset: centerPx - regionCenter };
}

function CameraDirector({ mode, chapter, n, insets, mapScroll, view, pulse, won, stage }: {
  mode: WorldMode; chapter: number; n: number; insets: { top: number; bottom: number }; mapScroll?: MapScroll; view: 'tilt' | 'top'; pulse: unknown; won: boolean; stage: string;
}) {
  const { camera, size } = useThree();
  const pos = useRef(new Vector3(0, 40, 90));
  const target = useRef(new Vector3(0, 0, 0));
  const offset = useRef(0);
  const projection = useRef({ width: 0, height: 0, offset: Number.NaN });
  const started = useRef({ mode: '' as string, at: 0, chapter: -1, stage: '' });
  const framing = useRef({ key: '', d: 10, offset: 0 });
  const punch = useRef({ last: pulse, at: -10 });
  const curve = useMemo(() => new CatmullRomCurve3(introPaths[chapter]!.map(p => new Vector3(...p))), [chapter]);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const sceneChanged = started.current.mode !== mode || started.current.chapter !== chapter || started.current.stage !== stage;
    if (sceneChanged) started.current = { mode, at: t, chapter, stage };
    const mt = t - started.current.at;
    const cam = camera as PerspectiveCamera;
    const W = size.width, H = size.height, aspect = W / Math.max(1, H);
    if (W <= 0 || H <= 0) return;
    // Portrait phones see far less horizontally; pull cinematic shots back so subjects stay in frame.
    const pf = Math.min(1.75, Math.max(1, .7 / aspect));
    const fkey = `${n}:${W}:${H}:${insets.top}:${insets.bottom}:${view}:${stage}`;
    if (framing.current.key !== fkey) {
      const saved = { p: cam.position.clone(), q: cam.quaternion.clone() };
      framing.current = { key: fkey, ...frameBoard(cam, n, W, H, insets.top, insets.bottom, view === 'top' ? TOP_DIR : GAME_DIR) };
      cam.position.copy(saved.p); cam.quaternion.copy(saved.q);
      projection.current.width = 0;
    }
    const fr = framing.current;
    let off = 0, k = 2.4;
    const v = vistas[chapter]!;
    switch (mode) {
      case 'game': case 'fail': {
        // Directed play camera: a sweeping reveal, a slow breathing drift, a punch on every tap and a push-in on victory.
        if (punch.current.last !== pulse) { punch.current.last = pulse; punch.current.at = t; }
        const reveal = Math.min(1, mt / 1.4), ease = 1 - Math.pow(1 - reveal, 3);
        const tap = Math.exp(-(t - punch.current.at) * 7) * .035;
        const drift = view === 'top' ? .4 : 1;
        const yawA = (1 - ease) * .65 + Math.sin(t * .23) * .028 * drift;
        const winPush = won ? Math.min(1, (t - punch.current.at) / 2.5) * .07 : 0;
        const dist = fr.d * (mode === 'fail' ? 1.12 : 1) * (1 + (1 - ease) * .35 - tap - winPush);
        tmpTarget.set(0, 0, 0);
        tmpPos.copy(view === 'top' ? TOP_DIR : GAME_DIR).applyAxisAngle(UP, yawA).multiplyScalar(dist);
        tmpPos.y += Math.sin(t * .31) * .12 * drift;
        off = fr.offset;
        k = mt < .05 ? 60 : 3.5;
        break;
      }
      case 'complete': {
        const a = Math.sin(t * .15) * .5, d = fr.d * 1.05;
        tmpTarget.set(0, .2, 0);
        tmpPos.set(Math.sin(a) * d * .56, d * .82, Math.cos(a) * d * .56);
        off = H * .04; k = 1.4;
        break;
      }
      case 'outro': {
        const rise = Math.min(mt, 4) / 4;
        tmpTarget.set(0, 1.5 + rise * 4, 0);
        tmpPos.set(Math.sin(t * .2) * 2 + n * .4, 3 + rise * 3, (n * 1.4 + 8) * pf);
        k = 1.2;
        break;
      }
      case 'menu': case 'forge': {
        // The Amulet floats in open sky; scale distance so its ring spans ~78% of the screen width.
        tmpTarget.set(ALTAR[0], ALTAR[1] + (mode === 'menu' ? -.25 : .1), ALTAR[2]);
        const d = Math.max(7, 2.15 / (Math.tan((cam.fov * Math.PI) / 360) * aspect * .7)) * (mode === 'forge' ? .85 : 1);
        tmpPos.set(ALTAR[0] + Math.sin(t * .12) * .8, ALTAR[1] + .3 + Math.sin(t * .17) * .2, ALTAR[2] + d);
        // Centre the Amulet in the band between the title crest and the buttons. A negative view offset moves content down the screen.
        off = mode === 'menu' ? -H * .03 : 0; k = 1.8;
        break;
      }
      case 'map': {
        // Drift gently over each world's scenery while scrolling; stay level so the sky and props stay in frame.
        const p = mapScroll?.progress ?? 0;
        tmpTarget.set((p - .5) * 6, 1 - p * 3, -18);
        tmpPos.set(Math.sin(t * .08) * 2 - (p - .5) * 4, 7 - p * 4, 24 * pf);
        k = 2.2;
        break;
      }
      case 'intro': {
        const p = Math.min(1, mt / 10.5);
        const e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        curve.getPoint(e, tmpPos);
        tmpPos.multiplyScalar(pf);
        tmpTarget.set(...v.target).lerp(origin, Math.min(1, e * 1.3));
        k = 30;
        break;
      }
      case 'prologue': {
        const d = Math.max(9, 17 - mt * .4) * pf;
        tmpTarget.set(0, 4, 0);
        tmpPos.set(Math.sin(t * .15) * d, 5 + Math.sin(t * .2), Math.cos(t * .15) * d);
        if (mt > 12.8 && mt < 13.6) tmpPos.addScalar((Math.random() - .5) * .8);
        k = mt < .1 ? 60 : 2;
        break;
      }
      case 'ending': {
        tmpTarget.set(ALTAR[0], ALTAR[1] + .2, ALTAR[2]);
        const d = Math.max(7.4, 2.15 / (Math.tan((cam.fov * Math.PI) / 360) * aspect * .78)) + Math.max(0, mt - 5) * .5;
        tmpPos.set(ALTAR[0] + Math.sin(t * .1) * 1.5, ALTAR[1] + .6 + Math.max(0, mt - 5) * .3, ALTAR[2] + d);
        k = 1.4;
        break;
      }
      default: {
        tmpTarget.set(...v.target);
        tmpPos.set(v.pos[0] + Math.sin(t * .08) * 3, v.pos[1] + Math.sin(t * .11) * .8, v.pos[2] * pf);
        k = mode === 'splash' ? 1 : 1.6;
      }
    }
    const a = 1 - Math.exp(-dt * k);
    if (sceneChanged && mode === 'game') {
      pos.current.copy(tmpPos);
      target.current.copy(tmpTarget);
      offset.current = off;
    }
    pos.current.lerp(tmpPos, a);
    target.current.lerp(tmpTarget, a);
    offset.current += (off - offset.current) * a;
    cam.position.copy(pos.current);
    cam.lookAt(target.current);
    if (projection.current.width !== W || projection.current.height !== H || Math.abs(projection.current.offset - offset.current) > .01) {
      cam.setViewOffset(W, H, 0, offset.current, W, H);
      cam.updateProjectionMatrix();
      projection.current = { width: W, height: H, offset: offset.current };
    }
  });
  return null;
}

function Prologue() {
  const prism = useRef<Group>(null);
  const shards = useRef<Group>(null);
  const flash = useRef<Sprite>(null);
  const start = useRef(-1);
  const mat = useMemo(() => new MeshStandardMaterial({ color: '#ffffff', roughness: .05, metalness: .3, emissive: '#ffffff', emissiveIntensity: .5, flatShading: true, transparent: true, opacity: .92 }), []);
  useFrame(({ clock }) => {
    if (start.current < 0) start.current = clock.elapsedTime;
    const t = clock.elapsedTime - start.current;
    const shattered = t > 12.8;
    if (prism.current) { prism.current.visible = !shattered; prism.current.rotation.y = t * .4; prism.current.position.y = 4 + Math.sin(t) * .2; }
    mat.emissive.setHSL((t * .08) % 1, .8, .55);
    if (shards.current) shards.current.children.forEach((s, i) => {
      const a = (i / 5) * Math.PI * 2 + t * (shattered ? .2 : 1.2);
      const rad = shattered ? 1.6 + (t - 12.8) * 6 : 1.6;
      s.position.set(Math.cos(a) * rad, 4 + (shattered ? (i - 2) * (t - 12.8) * 1.4 : Math.sin(t * 2 + i) * .3), Math.sin(a) * rad);
      s.scale.setScalar(shattered ? Math.max(.001, 1 - (t - 12.8) * .2) : t > 4.5 ? .8 : .001);
      s.rotation.y = t * 3;
    });
    if (flash.current) { const f = t > 12.8 ? Math.max(0, 1 - (t - 12.8) * 1.4) : 0; flash.current.scale.setScalar(1 + f * 40); flash.current.material.opacity = f; }
  });
  return <group>
    <group ref={prism}><mesh material={mat} scale={[2, 2.8, 2]}><octahedronGeometry args={[1, 0]} /></mesh>
      <sprite scale={[9, 9, 1]}><spriteMaterial map={glowTexture} color="#ffffff" opacity={.5} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} /></sprite>
    </group>
    <group ref={shards}>{chapters.map(c => <group key={c.id}>
      <mesh geometry={heartGeometry} scale={.5}><meshStandardMaterial color={c.heartColor} emissive={c.heartColor} emissiveIntensity={1.4} flatShading /></mesh>
      <sprite scale={[2.4, 2.4, 1]}><spriteMaterial map={glowTexture} color={c.heartColor} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} /></sprite>
    </group>)}</group>
    <sprite ref={flash} position={[0, 4, 0]}><spriteMaterial map={glowTexture} color="#ffffff" opacity={0} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} /></sprite>
  </group>;
}

/** Chapter cleared: a beacon of the chapter's light climbs into the sky and opens the road onward. */
function Beacon({ chapter }: { chapter: number }) {
  const gem = useRef<Group>(null);
  const column = useRef<Mesh>(null);
  const start = useRef(-1);
  const color = looks[chapter]!.crystal;
  useFrame(({ clock }) => {
    if (start.current < 0) start.current = clock.elapsedTime;
    const t = clock.elapsedTime - start.current;
    const e = 1 - Math.pow(1 - Math.min(1, t / 3), 3);
    if (gem.current) { gem.current.position.y = 1 + e * 4.5; gem.current.rotation.y = t * 2; gem.current.scale.setScalar(.3 + e * .7); }
    if (column.current) { const k = Math.max(0, Math.min(1, (t - 2.6) * 2)); column.current.scale.set(k * 1.2 + .001, 1, k * 1.2 + .001); (column.current.material as MeshBasicMaterial).opacity = k * .5; }
  });
  return <group>
    <group ref={gem}>
      <mesh geometry={gemGeometry}><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} flatShading roughness={.1} /></mesh>
      <sprite scale={[5, 5, 1]}><spriteMaterial map={glowTexture} color={color} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} /></sprite>
    </group>
    <mesh ref={column} position={[0, 105, 0]}><cylinderGeometry args={[.6, .6, 200, 16, 1, true]} />
      <meshBasicMaterial color={color} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} /></mesh>
  </group>;
}

function WorldContent(props: WorldProps) {
  const { chapter, mode, level } = props;
  const envChapter = mode === 'prologue' || mode === 'ending' ? 4 : chapter;
  const look = looks[envChapter]!;
  const boardLook = looks[chapter]!;
  const { gl } = useThree();
  useEffect(() => () => {
    const targets = environmentTargets.get(gl);
    targets?.forEach(target => target.dispose());
    targets?.clear();
    environmentTargets.delete(gl);
    environmentGenerators.get(gl)?.dispose();
    environmentGenerators.delete(gl);
  }, [gl]);
  const storm = useMemo<Storm>(() => ({ flash: { value: 0 } }), []);
  useEffect(() => { gl.toneMappingExposure = look.light.exposure; }, [gl, look]);
  const eye: EyeState = mode === 'ending' ? 'closing' : mode === 'prologue' || (chapter === 4 && level.index >= 24 && boardModes.includes(mode)) ? 'angry' : 'idle';
  const showBoard = boardModes.includes(mode);
  const sounds = mode === 'game' || mode === 'complete';
  const forgeHearts = props.forging !== undefined ? props.hearts.filter(h => h !== props.forging) : props.hearts;
  return <>
    <color attach="background" args={[look.fog.color]} />
    <fog key={envChapter} attach="fog" args={[look.fog.color, look.fog.near, look.fog.far]} />
    <ShaderClock />
    <EnvMap look={look} />
    <Lights look={look} storm={envChapter === 1 ? storm : undefined} dusk={props.dusk} />
    <SkyDome look={look} flash={storm.flash} dusk={props.dusk} />
    {envChapter === 0 && <SkyTemples look={look} />}
    {envChapter === 1 && <Rainforest look={look} storm={storm} onLight={() => undefined} />}
    {envChapter === 2 && <Desert look={look} />}
    {envChapter === 3 && <IceAge look={look} />}
    {envChapter === 4 && <TheVoid look={look} eye={eye} />}
    {showBoard && <BoardView key={props.boardKey} level={level} state={props.state} trace={props.trace} look={boardLook} chapter={chapter}
      hint={mode === 'game' ? props.hint : undefined} onTap={mode === 'game' ? props.onTap : undefined} onBlocked={props.onBlocked} sounds={sounds} />}
    {(mode === 'menu' || mode === 'forge' || mode === 'ending') && <group key={`${mode}:${props.forging}`} position={ALTAR}>
      <pointLight position={[0, 1.5, 4]} intensity={30} distance={14} color="#fff2dc" />
      <pointLight position={[-3, -2, 2]} intensity={14} distance={10} color={look.light.fill} />
      <Amulet hearts={forgeHearts} forging={mode === 'forge' ? props.forging : undefined} complete={mode === 'ending'} />
    </group>}
    {mode === 'prologue' && <Prologue />}
    {mode === 'outro' && <Beacon chapter={chapter} />}
    {__DEV__ && <PerformanceStats mode={mode} chapter={chapter} stage={props.boardKey} />}
    <CameraDirector mode={mode} chapter={envChapter} n={level.size} insets={props.insets} mapScroll={props.mapScroll} view={props.view ?? 'tilt'}
      pulse={props.state} won={props.trace.won} stage={props.boardKey} />
  </>;
}

export function World(props: WorldProps) {
  const onTapRef = useRef(props.onTap);
  const onBlockedRef = useRef(props.onBlocked);
  onTapRef.current = props.onTap;
  onBlockedRef.current = props.onBlocked;
  const onTap = useCallback((id: string) => onTapRef.current?.(id), []);
  const onBlocked = useCallback(() => onBlockedRef.current?.(), []);
  return <View style={StyleSheet.absoluteFill} pointerEvents={props.mode === 'game' ? 'auto' : 'none'}>
    <SceneBoundary>
      <Canvas shadows camera={{ fov: 38, near: .1, far: 900, position: [0, 40, 90] }} style={{ flex: 1 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}>
        <WorldContent {...props} onTap={onTap} onBlocked={onBlocked} />
      </Canvas>
    </SceneBoundary>
  </View>;
}
