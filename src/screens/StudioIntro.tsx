import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, PixelRatio, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { audio } from '../services/audio';

const nativeDriver = Platform.OS !== 'web';

/**
 * The capitals of Silkscreen, the pixel font of the YNOT Studio wordmark on the studio's site, as 5-row bitmaps: YNOT is
 * set in Bold, STUDIO and the letters it decodes through in Regular (Q is left out, its tail drops below the line).
 * Drawn as views, the pixels stay sharp at any density and need no font, so the card covers the app from its first frame.
 */
const BOLD: Record<string, string> = {
  Y: '##..##/.####./..##../..##../..##..', N: '##..##/###.##/######/##.###/##..##', O: '.###./##.##/##.##/##.##/.###.', T: '####/.##./.##./.##./.##.',
};
const REGULAR: Record<string, string> = {
  A: '.##./#..#/####/#..#/#..#', B: '###./#..#/####/#..#/###.', C: '.##./#..#/#.../#..#/.##.', D: '###./#..#/#..#/#..#/###.', E: '###/#../###/#../###',
  F: '###/#../###/#../#..', G: '.###/#.../#.##/#..#/.##.', H: '#..#/#..#/####/#..#/#..#', I: '#/#/#/#/#', J: '...#/...#/...#/#..#/.##.',
  K: '#..#/#.#./##../#.#./#..#', L: '#../#../#../#../###', M: '#...#/##.##/#.#.#/#...#/#...#', N: '#...#/##..#/#.#.#/#..##/#...#', O: '.##./#..#/#..#/#..#/.##.',
  P: '###./#..#/###./#.../#...', R: '###./#..#/###./#.#./#..#', S: '.###/#.../.##./...#/###.', T: '###/.#./.#./.#./.#.', U: '#..#/#..#/#..#/#..#/.##.',
  V: '#...#/#...#/.#.#./.#.#./..#..', W: '#...#/#.#.#/#.#.#/#.#.#/.#.#.', X: '#...#/.#.#./..#../.#.#./#...#', Y: '#...#/.#.#./..#../..#../..#..', Z: '###/..#/.#./#../###',
};

/** The site's near-white YNOT and muted STUDIO, on the game's own near-black, so Android's launch screen hands over seamlessly. */
const INK = '#05030f', TEXT = '#f4f4f5', MUTED = '#a6a6ae';
/**
 * The navbar's proportions: STUDIO at .56 of YNOT's size, .35 em apart (3 of its pixels on top of the glyphs' own 2),
 * .4 em after YNOT, baselines level. In bold pixels the whole wordmark is about 57 wide.
 */
const STUDIO_SIZE = .56, STUDIO_GAP = 5, WORD_GAP = 3.2, SPAN = 57;
/**
 * Card timeline (ms): the pixels gather, STUDIO decodes, a wave runs through YNOT, and the finished wordmark then rests,
 * still, for SETTLED before the card fades into the game. All of it hangs off one native-driven clock, because the 3D
 * world blocks the JS thread for seconds while it loads and JS timers would bunch up behind it. The sting
 * (scripts/generate-audio.mjs, 'studio') is composed to these same times.
 */
const FLY = 900, GLOW_AT = 300, GLOW = 1600, DECODE_AT = 1500, DECODE = 1300, WAVE_AT = 2700, WAVE = 700, MOTES_AT = 1400, MOTE_IN = 800;
const SETTLED = 1500, HOLD = WAVE_AT + WAVE + SETTLED, STILL_HOLD = 2000, FADE = 600;
/** Where the sting's closing chord lands: STUDIO's last letter settling, the wordmark complete. */
const BLOOM = DECODE_AT + .98 * DECODE;
/**
 * How far ahead of the card the sting starts, for the time a phone takes to get a started sound out of its speaker. On
 * the emulator, whose audio adds its own delay, every beat still came about .4 s after its frame.
 */
const AUDIO_LEAD = 150;
const FLY_EASE = Easing.out(Easing.back(1.5)), SOFT = Easing.out(Easing.quad);
/** Each STUDIO letter shows a new random letter every FLICKER of the decode, cycling through LAYERS of them. */
const FLICKER = .07, LAYERS = 4;

const rows = (glyph: string) => glyph.split('/');
const glyphWidth = (glyph: string) => rows(glyph)[0]!.length;
/** A glyph's lit pixels merged into horizontal runs, which is all a still letter needs. */
function runs(glyph: string) {
  const out: { x: number; y: number; w: number }[] = [];
  rows(glyph).forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== '#') continue;
      const start = x;
      while (row[x + 1] === '#') x++;
      out.push({ x: start, y, w: x - start + 1 });
    }
  });
  return out;
}

/** A fixed random stream, so the pixels fly in the same way on every launch. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = seeded(20261029);

/** Every pixel of YNOT, in bold pixels from the Y's top left, with where it flies in from and when. */
let ynotWidth = 0;
const YNOT = [...'YNOT'].flatMap((ch, letter) => {
  const glyph = BOLD[ch]!, left = ynotWidth;
  ynotWidth += glyphWidth(glyph) + 2;
  return rows(glyph).flatMap((row, y) => [...row].flatMap((c, x) => {
    if (c !== '#') return [];
    const angle = rand() * Math.PI * 2, distance = 6 + rand() * 14;
    return [{ x: left + x, y, dx: Math.cos(angle) * distance, dy: Math.sin(angle) * distance - 5, spin: (rand() - .5) * 400, delay: 150 + letter * 170 + rand() * 280 }];
  }));
});
ynotWidth -= 2;

/** STUDIO's letters, in regular pixels: each flickers through random letters, then settles, left to right. */
let studioWidth = 0;
const STUDIO = [...'STUDIO'].map((ch, i) => {
  const glyph = REGULAR[ch]!, w = glyphWidth(glyph), left = studioWidth, from = .01 + i * .04, lock = .38 + i * .12;
  studioWidth += w + STUDIO_GAP;
  const steps: number[] = [];
  for (let t = from; t < lock - .001; t += FLICKER) steps.push(t);
  const pool = Object.keys(REGULAR).filter(k => k !== ch);
  const layers = Array.from({ length: Math.min(LAYERS, steps.length) }, () => {
    const pick = REGULAR[pool.splice(Math.floor(rand() * pool.length), 1)[0]!]!;
    return { glyph: pick, x: Math.floor((w - glyphWidth(pick)) / 2), input: [] as number[], output: [] as number[] };
  });
  steps.forEach((t, j) => {
    const layer = layers[j % layers.length]!, end = Math.min(t + FLICKER, lock);
    layer.input.push(t - .001, t, end - .001, end);
    layer.output.push(0, 1, 1, 0);
  });
  return { x: left, glyph, lock, layers };
});
studioWidth -= STUDIO_GAP;

/** Faint drifting pixels around the card, like the site's hero (x and y in % of the screen, size in bold pixels). */
const MOTES = ([[8, 14, .5], [22, 30, .75], [35, 8, .5], [48, 22, 1], [62, 12, .5], [77, 28, .75], [91, 17, .5], [12, 40, .5], [87, 37, .75],
  [5, 61, .75], [27, 60, .5], [70, 59, .5], [24, 72, .5], [40, 87, .75], [56, 75, .5], [69, 91, .5], [83, 67, 1], [94, 81, .5]] as const)
  .map(([x, y, size]) => ({ x, y, size, delay: rand() * 900, phase: rand(), rise: 3 + rand() * 6, peak: .15 + rand() * .65, duration: 3000 + rand() * 3000 }));

/** An easing sampled into interpolation stops on the clock, which native interpolation can play without JS. */
function eased(from: number, duration: number, easing: (t: number) => number, steps: number) {
  const inputRange: number[] = [], outputRange: number[] = [];
  for (let i = 0; i <= steps; i++) {
    inputRange.push(from + (duration * i) / steps);
    outputRange.push(easing(i / steps));
  }
  return { inputRange, outputRange, extrapolate: 'clamp' as const };
}

/** Rounds to whole device pixels, so every pixel of the wordmark comes out the same size. */
const snap = (dp: number) => Math.max(1, Math.round(dp * PixelRatio.get())) / PixelRatio.get();

/** One still letter, drawn as runs of `px`-sized pixels. */
function Glyph({ glyph, px, color }: { glyph: string; px: number; color: string }) {
  return <View style={{ width: glyphWidth(glyph) * px, height: 5 * px }}>
    {runs(glyph).map((run, i) => <View key={i} style={{ position: 'absolute', left: run.x * px, top: run.y * px, width: run.w * px, height: px, backgroundColor: color }} />)}
  </View>;
}

/**
 * The studio card that opens every launch: the YNOT Studio wordmark from the site's navbar. Its pixels gather into YNOT,
 * STUDIO decodes letter by letter, a wave runs through YNOT, and the card fades to reveal the game (onReveal when the
 * fade starts, onDone when it ends). A tap skips to the fade; with reduced motion the wordmark simply fades in.
 * `sound` (the save is loaded and has sound on, and the game is in front) lets its sting play; the world's music and
 * ambience wait until the card leaves, then fade in.
 */
export function StudioIntro({ sound, onReveal, onDone }: { sound: boolean; onReveal: () => void; onDone: () => void }) {
  const { width } = useWindowDimensions();
  const callbacks = useRef({ onReveal, onDone });
  callbacks.current = { onReveal, onDone };
  const leave = useRef<() => void>(() => undefined);
  /** The sting's time 0 (when the clock started), whether the card fell back to its still version, and the sting's state. */
  const sting = useRef({ origin: Date.now(), still: false, state: 'waiting' as 'waiting' | 'playing' | 'done' });
  const [v] = useState(() => ({
    clock: new Animated.Value(0), show: new Animated.Value(1), fade: new Animated.Value(1), breathe: new Animated.Value(0),
    drift: MOTES.map(m => new Animated.Value(m.phase)),
  }));

  useEffect(() => {
    let live = true, left = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const timing = (value: Animated.Value, toValue: number, duration: number, easing = Easing.inOut(Easing.sin)) =>
      Animated.timing(value, { toValue, duration, easing, useNativeDriver: nativeDriver });
    leave.current = () => {
      if (left || !live) return;
      left = true;
      // The world's music and ambience start now (the parent holds them back while the card plays) and fade in.
      audio.setHush(0);
      audio.setHush(1, FADE + 900);
      callbacks.current.onReveal();
      audio.endSting(FADE);
      timing(v.fade, 0, FADE, Easing.inOut(Easing.quad)).start(() => { if (live) callbacks.current.onDone(); });
    };
    audio.prepareSting();
    const clock = timing(v.clock, HOLD, HOLD, Easing.linear);
    const loops = [Animated.loop(Animated.sequence([timing(v.breathe, 1, 2600), timing(v.breathe, 0, 2600)])),
      ...MOTES.map((m, i) => Animated.loop(Animated.sequence([timing(v.drift[i]!, 1, m.duration), timing(v.drift[i]!, 0, m.duration)])))];
    clock.start(({ finished }) => { if (finished) leave.current(); });
    sting.current.origin = Date.now();
    loops.forEach(l => l.start());
    // The system setting arrives a moment later: with less motion asked for, the settled wordmark fades in instead.
    AccessibilityInfo.isReduceMotionEnabled().then(still => {
      if (!still || !live || left) return;
      clock.stop();
      loops.forEach(l => l.stop());
      v.clock.setValue(HOLD);
      v.breathe.setValue(0);
      v.drift.forEach(d => d.setValue(0));
      v.show.setValue(0);
      timing(v.show, 1, 400).start();
      sting.current.still = true;
      if (sting.current.state === 'playing') audio.playSting(BLOOM - 200);
      timers.push(setTimeout(() => leave.current(), STILL_HOLD));
    }, () => undefined);
    return () => {
      live = false; timers.forEach(clearTimeout); clock.stop(); loops.forEach(l => l.stop());
      audio.endSting();
    };
  }, [v]);

  // The sting starts once the save says sound is on, from as far in as the card has got, so the two stay in step. If that
  // takes until the wordmark is complete (a slow phone loading the world), or in the still version, its closing chord
  // plays over the finished wordmark. Sound switched off, or the game sent away, stops it.
  useEffect(() => {
    const s = sting.current;
    if (sound && s.state === 'waiting') {
      const at = Date.now() - s.origin;
      s.state = 'playing';
      audio.playSting(s.still || at > BLOOM ? BLOOM - 200 : at + AUDIO_LEAD);
    } else if (!sound && s.state === 'playing') {
      s.state = 'done';
      audio.endSting();
    }
  }, [sound]);

  /** Built once per screen width: the parent re-renders while the game loads, and the animated pixels must not be rebuilt. */
  const card = useMemo(() => {
    const b = snap(Math.min(width * .8 / SPAN, 9)), r = snap(b * STUDIO_SIZE);
    const studioX = snap((ynotWidth + 1 + WORD_GAP) * b + r), w = studioX + studioWidth * r, h = 5 * b, gw = w * 1.5, gh = w * .75;
    const decode = v.clock.interpolate({ inputRange: [DECODE_AT, DECODE_AT + DECODE], outputRange: [0, 1], extrapolate: 'clamp' });
    const wave = v.clock.interpolate(eased(WAVE_AT, WAVE, Easing.inOut(Easing.sin), 12));
    const motes = MOTES.map((m, i) => {
      const drift = v.drift[i]!, size = snap(m.size * b);
      return <Animated.View key={i} style={{ position: 'absolute', left: `${m.x}%`, top: `${m.y}%`, width: size, height: size, backgroundColor: '#fff',
        opacity: Animated.multiply(v.clock.interpolate(eased(MOTES_AT + m.delay, MOTE_IN, SOFT, 6)), drift.interpolate({ inputRange: [0, 1], outputRange: [.5, m.peak] })),
        transform: [{ translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -m.rise * b] }) }] }} />;
    });
    const glow = <Animated.View style={{ position: 'absolute', left: (w - gw) / 2, top: (h - gh) / 2, width: gw, height: gh,
      opacity: Animated.multiply(v.clock.interpolate(eased(GLOW_AT, GLOW, SOFT, 10)), v.breathe.interpolate({ inputRange: [0, 1], outputRange: [1, .75] })),
      transform: [{ scale: v.breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] }}>
      <Svg width={gw} height={gh}>
        <Defs>
          <RadialGradient id="ynotStudioGlow">
            <Stop offset="0" stopColor="#fff" stopOpacity="0.1" />
            <Stop offset="0.45" stopColor="#fff" stopOpacity="0.04" />
            <Stop offset="1" stopColor="#fff" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse cx={gw / 2} cy={gh / 2} rx={gw / 2} ry={gh / 2} fill="url(#ynotStudioGlow)" />
      </Svg>
    </Animated.View>;
    const ynot = YNOT.map((p, i) => {
      const f = v.clock.interpolate(eased(p.delay, FLY, FLY_EASE, 20)), at = .16 + ((p.x + .5) / ynotWidth) * .68;
      return <Animated.View key={i} style={{ position: 'absolute', left: p.x * b, top: p.y * b, width: b, height: b, backgroundColor: TEXT,
        opacity: f.interpolate({ inputRange: [0, .3], outputRange: [0, 1], extrapolate: 'clamp' }),
        transform: [
          { translateX: f.interpolate({ inputRange: [0, 1], outputRange: [p.dx * b, 0] }) },
          { translateY: Animated.add(f.interpolate({ inputRange: [0, 1], outputRange: [p.dy * b, 0] }),
            wave.interpolate({ inputRange: [at - .16, at, at + .16], outputRange: [0, -b, 0], extrapolate: 'clamp' })) },
          { rotate: f.interpolate({ inputRange: [0, 1], outputRange: [`${p.spin}deg`, '0deg'] }) },
          { scale: f.interpolate({ inputRange: [0, 1], outputRange: [.3, 1] }) },
        ] }} />;
    });
    const studio = STUDIO.map((c, i) => <View key={i} style={{ position: 'absolute', left: studioX + c.x * r, top: h - 5 * r }}>
      {c.layers.map((l, j) => <Animated.View key={j} style={{ position: 'absolute', left: l.x * r,
        opacity: decode.interpolate({ inputRange: l.input, outputRange: l.output, extrapolate: 'clamp' }) }}><Glyph glyph={l.glyph} px={r} color={MUTED} /></Animated.View>)}
      <Animated.View style={{ opacity: decode.interpolate({ inputRange: [c.lock - .001, c.lock], outputRange: [0, 1], extrapolate: 'clamp' }) }}>
        <Glyph glyph={c.glyph} px={r} color={MUTED} />
      </Animated.View>
    </View>);
    return <>
      {motes}
      <Animated.View style={{ width: w, height: h, opacity: v.show, transform: [{ scale: v.fade.interpolate({ inputRange: [0, 1], outputRange: [1.05, 1] }) }] }}>
        {glow}{ynot}{studio}
      </Animated.View>
    </>;
  }, [width, v]);

  return <Animated.View style={[s.root, { opacity: v.fade }]}>
    <Pressable style={s.center} onPress={() => leave.current()} accessibilityLabel="YNOT Studio" accessibilityHint="Skips to the game">{card}</Pressable>
  </Animated.View>;
}

const s = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: INK },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
