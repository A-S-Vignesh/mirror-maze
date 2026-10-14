import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { chapters, LEVELS_PER_CHAPTER } from '../game/chapters';
import { levels } from '../game/levels';
import { Progress, SHARDS_PER_WORLD, totalShards, unlockedLevel, worldShards } from '../game/progress';
import { Seen } from '../services/storage';
import { fitTitle, Gem, TitleArt } from '../ui/Art';
import { fonts } from '../ui/fonts';
import { GameText } from '../ui/GameText';
import { MiniBoard, miniCenter, miniHeight, MiniState } from '../ui/MiniBoard';
import { GameIcon, RoundButton, ShardPill, useUI } from '../ui/Toy';
import { looks } from '../world/look';
import { MapScroll } from '../world/World';
import { audio } from '../services/audio';

export type StoryKind = 'prologue' | 'intro' | 'outro' | 'forge' | 'ending';
const STEP = 196;
const PAD = 110;
const nativeDriver = Platform.OS !== 'web';

interface Section { chapter: number; gateTop: number; gateH: number; levelsTop: number; levelsH: number }

function useLayout(width: number, height: number) {
  return useMemo(() => {
    const sections: Section[] = [];
    let y = 0;
    for (let c = 0; c < chapters.length; c++) {
      // Gates between worlds are tall veils whose opaque middle covers the whole screen while the 3D world behind swaps.
      const gateH = c === 0 ? Math.max(560, height * .78) : Math.round(height * 1.75);
      const levelsH = LEVELS_PER_CHAPTER * STEP + PAD * 2;
      sections.push({ chapter: c, gateTop: y, gateH, levelsTop: y + gateH, levelsH });
      y += gateH + levelsH;
    }
    const amp = Math.min(width * .24, 150);
    // A gentle zig-zag so consecutive beams bounce left and right like light between mirrors.
    const nodeX = (c: number, i: number) => width / 2 + Math.sin(i * 1.05 + c * 1.3) * amp;
    const nodeY = (sec: Section, i: number) => sec.levelsTop + PAD + i * STEP;
    return { sections, total: y + 320, nodeX, nodeY };
  }, [width, height]);
}

/** Gentle bobbing; inactive loops render still so a long map does not run hundreds of animations. */
function Loop({ children, duration, from = 0, to = -8, style, active = true }: { children: React.ReactNode; duration: number; from?: number; to?: number; style?: object; active?: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) { v.setValue(0); return; }
    const l = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver }),
      Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver }),
    ]));
    l.start();
    return () => l.stop();
  }, [v, duration, active]);
  return <Animated.View style={[style, { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, to] }) }] }]}>{children}</Animated.View>;
}

function Ring({ color, size }: { color: string; size: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: nativeDriver }));
    l.start();
    return () => l.stop();
  }, [v]);
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: color,
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [.9, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }] }} />;
}

const boardWidth = (id: number, boss: boolean) => (id === levels.length ? 220 : boss ? 205 : 176);

const LevelNode = memo(function LevelNode({ id, state, shards }: { id: number; state: MiniState; shards: number }) {
  const lvl = levels[id - 1]!;
  const c = lvl.chapter;
  const look = looks[c]!;
  const heart = chapters[c]!.heartColor;
  const boss = lvl.boss;
  const final = id === levels.length;
  const W = boardWidth(id, boss);
  const H = miniHeight(W);
  const medal = final ? 54 : boss ? 48 : 40;
  const shake = useRef(new Animated.Value(0)).current;
  return <Animated.View style={{ width: W, alignItems: 'center', transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] }) }] }}>
    {(boss || final) && state !== 'locked' && <View pointerEvents="none" style={[s.aura, { width: W * 1.2, height: W * .9, borderRadius: W, backgroundColor: `${heart}30`, top: H * .05 }]} />}
    <MiniBoard chapter={c} state={state} width={W} />
    <View pointerEvents="none" style={[s.medalWrap, { top: miniCenter(W) - medal * .75 }]}>
      {state === 'current' && <Ring color="#ffe08a" size={medal} />}
      <Loop duration={600} to={-7} active={state === 'current'}>
        <LinearGradient colors={['#fff4cc', '#e6b85a', '#8a5a1e']} style={{ width: medal, height: medal, borderRadius: medal / 2, padding: 2.5 }}>
          <LinearGradient colors={state === 'locked' ? ['#2a3048', '#0d1020'] : state === 'current' ? ['#fff0b8', '#d89a22'] : [look.crystal, look.crystalGlow]}
            start={{ x: .2, y: 0 }} end={{ x: .8, y: 1 }} style={[s.medal, { borderRadius: medal / 2 }]}>
            <LinearGradient colors={['#ffffff70', '#ffffff00']} style={[s.gloss, { borderRadius: medal }]} />
            {state === 'locked' ? <GameIcon name="lock-closed" size={medal * .38} color="#8a94b4" />
              : final ? <GameIcon name="eye" size={medal * .5} color="#fff" />
              : boss ? <Gem size={medal * .55} color={heart} />
              : <GameText size={medal * .42} font="cinemaBold" strokeWidth={0} style={s.num}>{String(lvl.index)}</GameText>}
          </LinearGradient>
        </LinearGradient>
      </Loop>
      {state === 'current' && <View style={s.play}><GameText size={10} font="cinemaBold" strokeWidth={0} style={{ color: '#3a2200', letterSpacing: 1.5 }}>PLAY</GameText></View>}
    </View>
    <View pointerEvents="none" style={s.below}>
      {state === 'done' && <View style={s.shards}>{[1, 2, 3].map(i => <Gem key={i} size={i === 2 ? 17 : 14} color={i <= shards ? look.crystal : 'gray'} />)}</View>}
      {(boss || final) && <View style={[s.bossTag, { borderColor: `${heart}cc` }]}>
        <GameText size={10} font="cinemaBold" strokeWidth={0} style={{ color: '#fff', letterSpacing: 2 }}>{final ? 'THE VOID EYE' : 'FINAL TRIAL'}</GameText>
      </View>}
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={`Map level ${id}${state === 'locked' ? ', locked' : `, ${lvl.title}`}`} style={StyleSheet.absoluteFill}
      onPress={() => {
        if (state === 'locked') {
          audio.play('bonk'); audio.haptic('error');
          Animated.sequence([-1, 1, -1, 0].map(x => Animated.timing(shake, { toValue: x, duration: 50, useNativeDriver: nativeDriver }))).start();
          return;
        }
        audio.play('whoosh'); onPressRef.current?.(id);
      }} />
  </Animated.View>;
});
// Node presses route through a ref so memoised nodes never re-render when the parent's callbacks change.
const onPressRef: { current?: (id: number) => void } = {};

const MapLevel = memo(function MapLevel({ id, state, shards, active, left, top }: {
  id: number; state: MiniState; shards: number; active: boolean; left: number; top: number;
}) {
  const lvl = levels[id - 1]!;
  const W = boardWidth(id, lvl.boss);
  return <View style={{ position: 'absolute', left, top }}>
    {active ? <LevelNode id={id} state={state} shards={shards} />
      : <Pressable accessibilityRole="button" accessibilityLabel={`Map level ${id}${state === 'locked' ? ', locked' : `, ${lvl.title}`}`}
        style={{ width: W, height: miniHeight(W) + 32 }} onPress={() => {
          if (state === 'locked') { audio.play('bonk'); audio.haptic('error'); return; }
          audio.play('whoosh'); onPressRef.current?.(id);
        }} />}
  </View>;
});

function StoryChip({ icon, label, onPress }: { icon: React.ComponentProps<typeof GameIcon>['name']; label: string; onPress: () => void }) {
  const { ui } = useUI();
  return <Pressable accessibilityRole="button" accessibilityLabel={`Watch ${label}`} onPress={onPress} hitSlop={6}
    style={({ pressed }) => [s.chip, { borderColor: `${ui.accent}cc`, transform: [{ scale: pressed ? .94 : 1 }] }]}>
    <GameIcon name={icon} size={13} color={ui.accent} />
    <GameText size={11} font="cinemaBold" strokeWidth={0} style={{ color: '#fff', letterSpacing: 1.5 }}>{label}</GameText>
  </Pressable>;
}

function Gate({ section, progress, width, next, hearts, seen, safeTop, active, onWatch }: {
  section: Section; progress: Progress; width: number; next: number; hearts: number[]; seen: Seen; safeTop: number; active: boolean; onWatch: (k: StoryKind, c: number) => void;
}) {
  const c = chapters[section.chapter]!;
  const look = looks[section.chapter]!;
  const ui = look.ui;
  const first = section.chapter * LEVELS_PER_CHAPTER + 1;
  const locked = next < first;
  const shards = worldShards(progress, section.chapter);
  const forged = hearts.includes(section.chapter);
  const veil = section.chapter === 0 ? ['#00000000', '#00000000', '#00000060', '#00000000'] : ['#00000000', ui.panel[1].slice(0, 7), ui.panel[1].slice(0, 7), '#00000000'];
  const ch = section.chapter;
  return <View style={{ position: 'absolute', top: section.gateTop, left: 0, width, height: section.gateH }} pointerEvents="box-none">
    {/* The veil is fully opaque between 30% and 70% of the gate; the 3D world swaps in that band, unseen. */}
    <LinearGradient pointerEvents="none" colors={veil as [string, string, string, string]} locations={[0, .3, .7, 1]} style={StyleSheet.absoluteFill} />
    <View style={[s.gateCard, { top: ch === 0 ? safeTop + 84 : section.gateH * .5 - 190 }]} pointerEvents="box-none">
      <Loop duration={2200} to={-6} active={active}><Gem size={66} color={forged ? c.heartColor : 'gray'} /></Loop>
      <View style={s.kicker}><GameText size={12} font="cinemaBold" strokeWidth={0} style={{ color: ui.accent, letterSpacing: 4 }}>{`CHAPTER ${c.number} · ${c.world.toUpperCase()}`}</GameText></View>
      <TitleArt lines={[c.title.toUpperCase()]} width={Math.min(width - 40, 420)} size={fitTitle(c.title, Math.min(width - 40, 420), 36)} fill={ui.title} stroke={ui.titleStroke} font={fonts.cinemaBold} />
      <GameText size={14} font="semi" strokeWidth={0} style={s.story}>{c.intro[0]}</GameText>
      <View style={[s.gateStats, { borderColor: `${ui.accent}66` }]} pointerEvents="none">
        {locked ? <><GameIcon name="lock-closed" size={15} color={ui.accent} /><GameText size={12} font="bold" strokeWidth={0} style={s.statText}>
          {`Clear ${chapters[ch - 1]?.title ?? ''} to enter`}</GameText></>
          : <><Gem size={15} color={look.crystal} /><GameText size={12} font="bold" strokeWidth={0} style={s.statText}>{`${shards}/${SHARDS_PER_WORLD}`}</GameText>
            <View style={s.dot} /><GameText size={12} font="bold" strokeWidth={0} style={[s.statText, forged && { color: c.heartColor }]}>{forged ? `${c.heart} forged` : `Forge the ${c.heart}`}</GameText></>}
      </View>
      <View style={s.chips} pointerEvents="box-none">
        {ch === 0 && seen.prologue && <StoryChip icon="book" label="PROLOGUE" onPress={() => onWatch('prologue', 0)} />}
        {!locked && <StoryChip icon="play" label="STORY" onPress={() => onWatch('intro', ch)} />}
        {seen.outros.includes(ch) && <StoryChip icon="sunny" label="FINALE" onPress={() => onWatch('outro', ch)} />}
        {seen.hearts.includes(ch) && <StoryChip icon="diamond" label="HEART" onPress={() => onWatch('forge', ch)} />}
      </View>
    </View>
  </View>;
}

/** Straight light beams bouncing from board to board; lit up to the furthest level reached. */
const Beams = memo(function Beams({ section, width, nodeX, nodeY, lit }: { section: Section; width: number; nodeX: (c: number, i: number) => number; nodeY: (s: Section, i: number) => number; lit: number }) {
  const look = looks[section.chapter]!;
  const pts = Array.from({ length: LEVELS_PER_CHAPTER }, (_, i) => [nodeX(section.chapter, i), nodeY(section, i) - section.levelsTop] as const);
  const paths = { litOuter: '', litInner: '', litCore: '', dim: '', dash: '' };
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    const segment = `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`;
    if (i < lit) {
      paths.litOuter += segment;
      paths.litInner += segment;
      paths.litCore += segment;
    } else {
      paths.dim += segment;
      paths.dash += segment;
    }
  }
  return <View style={{ position: 'absolute', top: section.levelsTop, left: 0 }} pointerEvents="none">
    <Svg width={width} height={section.levelsH}>
      {!!paths.litOuter && <Path d={paths.litOuter} stroke={look.beam} strokeWidth={18} strokeOpacity={.18} strokeLinecap="round" />}
      {!!paths.litInner && <Path d={paths.litInner} stroke={look.beam} strokeWidth={7} strokeOpacity={.55} strokeLinecap="round" />}
      {!!paths.litCore && <Path d={paths.litCore} stroke={look.beamGlow} strokeWidth={2.6} strokeLinecap="round" />}
      {!!paths.dim && <Path d={paths.dim} stroke="#000" strokeOpacity={.3} strokeWidth={6} strokeLinecap="round" />}
      {!!paths.dash && <Path d={paths.dash} stroke="#ffffff" strokeOpacity={.35} strokeWidth={2} strokeDasharray="3 9" strokeLinecap="round" />}
    </Svg>
  </View>;
});

/** Bright motes of light racing along the lit beams of the world in view. */
function Motes({ section, nodeX, nodeY, lit, active }: { section: Section; nodeX: (c: number, i: number) => number; nodeY: (s: Section, i: number) => number; lit: number; active: boolean }) {
  const look = looks[section.chapter]!;
  const count = Math.min(lit, LEVELS_PER_CHAPTER);
  const xs = Array.from({ length: count }, (_, i) => nodeX(section.chapter, i));
  const ys = Array.from({ length: count }, (_, i) => nodeY(section, i));
  const vals = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    if (!active || count < 2) return;
    const loops = vals.map((v, k) => Animated.loop(Animated.sequence([
      Animated.delay(k * 900),
      Animated.timing(v, { toValue: 1, duration: (count - 1) * 520, easing: Easing.linear, useNativeDriver: nativeDriver }),
      Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: nativeDriver }),
    ])));
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [vals, count, active]);
  if (count < 2) return null;
  const input = xs.map((_, i) => i / (count - 1));
  return <>{vals.map((v, k) => <Animated.View key={k} pointerEvents="none" style={[s.mote, {
    backgroundColor: look.beamGlow, shadowColor: look.beam,
    transform: [{ translateX: v.interpolate({ inputRange: input, outputRange: xs.map(x => x - 7) }) }, { translateY: v.interpolate({ inputRange: input, outputRange: ys.map(y => y - 7) }) }],
  }]} />)}</>;
}

/** Screen-space weather for the world in view: sunlit dust, rain, sand, snow or stars. */
function Weather({ chapter, width, height }: { chapter: number; width: number; height: number }) {
  const parts = useMemo(() => Array.from({ length: chapter === 1 ? 26 : 16 }, (_, i) => ({ x: ((i * 61) % 100) / 100, d: 1 + (i % 4) * .35, o: (i * 37) % 100 / 100 })), [chapter]);
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    const l = Animated.loop(Animated.timing(v, { toValue: 1, duration: chapter === 1 ? 1400 : chapter === 4 ? 6000 : 9000, easing: Easing.linear, useNativeDriver: nativeDriver }));
    l.start();
    return () => l.stop();
  }, [v, chapter]);
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    {parts.map((p, i) => {
      const phase = Animated.modulo(Animated.add(v, p.o), 1);
      if (chapter === 1) return <Animated.View key={i} style={[s.rain, { left: p.x * width, transform: [{ translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [-60, height + 60] }) }, { rotate: '12deg' }] }]} />;
      if (chapter === 3) return <Animated.View key={i} style={[s.snow, { left: p.x * width, width: 3 + p.d * 2, height: 3 + p.d * 2, transform: [
        { translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [-20, height + 20] }) },
        { translateX: phase.interpolate({ inputRange: [0, .5, 1], outputRange: [0, 18 * p.d, 0] }) }] }]} />;
      if (chapter === 2) return <Animated.View key={i} style={[s.sand, { top: p.o * height, transform: [{ translateX: phase.interpolate({ inputRange: [0, 1], outputRange: [-40, width + 40] }) }] }]} />;
      if (chapter === 4) return <Animated.View key={i} style={[s.star, { left: p.x * width, top: p.o * height, opacity: phase.interpolate({ inputRange: [0, .5, 1], outputRange: [.15, 1, .15] }) }]} />;
      return <Animated.View key={i} style={[s.dust, { left: p.x * width, transform: [{ translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [height + 10, -10] }) }],
        opacity: phase.interpolate({ inputRange: [0, .2, .8, 1], outputRange: [0, .9, .9, 0] }) }]} />;
    })}
  </View>;
}

export function JourneyMap({ progress, focus, scroll, seen, hearts, onChapter, onPlay, onBack, onWatch }: {
  progress: Progress; focus: number; scroll: MapScroll; seen: Seen; hearts: number[]; onChapter: (c: number) => void; onPlay: (id: number) => void; onBack: () => void;
  onWatch: (kind: StoryKind, chapter: number) => void;
}) {
  const { width, height } = useWindowDimensions();
  const safe = useSafeAreaInsets();
  const { ui } = useUI();
  const layout = useLayout(width, height);
  const ref = useRef<ScrollView>(null);
  const next = unlockedLevel(progress, levels.length + 1);
  const current = useRef(-1);
  const chapterTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [chapter, setChapter] = useState(0);
  const [band, setBand] = useState(0);
  const total = totalShards(progress);
  onPressRef.current = onPlay;
  const focusY = useCallback((id: number) => {
    const sec = layout.sections[Math.floor((id - 1) / LEVELS_PER_CHAPTER)]!;
    return Math.max(0, layout.nodeY(sec, (id - 1) % LEVELS_PER_CHAPTER) - height * .55);
  }, [layout, height]);
  const update = useCallback((y: number) => {
    const mid = y + height / 2;
    let c = 0;
    // The world swaps at the middle of each gate, where the opaque veil hides the change.
    for (const sec of layout.sections) if (sec.chapter > 0 && mid >= sec.gateTop + sec.gateH / 2) c = sec.chapter;
    const sec = layout.sections[c]!;
    scroll.progress = Math.min(1, Math.max(0, (mid - sec.levelsTop) / sec.levelsH));
    if (c !== current.current) {
      const initial = current.current < 0;
      current.current = c;
      setChapter(c);
      if (chapterTimer.current) clearTimeout(chapterTimer.current);
      if (initial) onChapter(c);
      else chapterTimer.current = setTimeout(() => { chapterTimer.current = undefined; onChapter(c); }, 180);
    }
    const bandSize = Math.max(240, height * .6);
    setBand(b => (Math.floor(b / bandSize) !== Math.floor(y / bandSize) ? Math.floor(y / bandSize) * bandSize : b));
  }, [layout, height, scroll, onChapter]);
  useEffect(() => () => { if (chapterTimer.current) clearTimeout(chapterTimer.current); }, []);
  useEffect(() => {
    const y = focusY(Math.min(focus, levels.length));
    update(y);
    setBand(y);
    const t = setTimeout(() => ref.current?.scrollTo({ y, animated: false }), 30);
    return () => clearTimeout(t);
    // Jump only when the requested focus changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, width, height]);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => update(e.nativeEvent.contentOffset.y);
  const nearView = (y: number) => y > band - height * .8 && y < band + height * 1.5;
  const sectionNear = (sec: Section) => sec.levelsTop < band + height * 1.6 && sec.levelsTop + sec.levelsH > band - height * .8;
  return <View style={StyleSheet.absoluteFill}>
    <Weather chapter={chapter} width={width} height={height} />
    <ScrollView ref={ref} onScroll={onScroll} scrollEventThrottle={32} showsVerticalScrollIndicator={false} contentContainerStyle={{ height: layout.total }}>
      {layout.sections.map(sec => {
        const first = sec.chapter * LEVELS_PER_CHAPTER + 1;
        const reached = Math.max(0, Math.min(LEVELS_PER_CHAPTER, next - first + 1));
        return <React.Fragment key={sec.chapter}>
          {nearView(sec.gateTop + sec.gateH / 2) && <Gate section={sec} progress={progress} width={width} next={next} hearts={hearts} seen={seen} safeTop={safe.top} active onWatch={onWatch} />}
          {sectionNear(sec) && <Beams section={sec} width={width} nodeX={layout.nodeX} nodeY={layout.nodeY} lit={reached} />}
          {sec.chapter === chapter && <Motes section={sec} nodeX={layout.nodeX} nodeY={layout.nodeY} lit={reached} active={sectionNear(sec)} />}
          {Array.from({ length: LEVELS_PER_CHAPTER }, (_, i) => {
            const id = first + i;
            const lvl = levels[id - 1]!;
            const state: MiniState = id === next ? 'current' : progress[id] ? 'done' : 'locked';
            const y = layout.nodeY(sec, i);
            const W = boardWidth(id, lvl.boss);
            return <MapLevel key={id} id={id} state={state} shards={progress[id]?.stars ?? 0} active={nearView(y)}
              left={layout.nodeX(sec.chapter, i) - W / 2} top={y - miniCenter(W)} />;
          })}
        </React.Fragment>;
      })}
      <View style={[s.footer, { top: layout.total - 290, width }]} pointerEvents="box-none">
        <View style={s.footerGems} pointerEvents="none">{chapters.map(c => <Gem key={c.id} size={34} color={hearts.includes(c.id) ? c.heartColor : 'gray'} />)}</View>
        <GameText size={14} font="cinemaBold" strokeWidth={0} style={{ color: '#fff', letterSpacing: 3, marginTop: 10 }}>{hearts.length === 5 ? 'THE PRISM IS WHOLE' : 'FORGE ALL FIVE HEARTS'}</GameText>
        <GameText size={13} font="semi" strokeWidth={0} style={{ color: '#dfe6f5', marginTop: 4 }}>{hearts.length === 5 ? 'Dawn has returned to every world' : 'to close the Void Eye forever'}</GameText>
        {seen.ending && <View style={{ marginTop: 12 }}><StoryChip icon="star" label="WATCH ENDING" onPress={() => onWatch('ending', 4)} /></View>}
      </View>
    </ScrollView>
    <LinearGradient pointerEvents="none" colors={['#000000c0', '#00000000']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: safe.top + 96 }} />
    <View style={[s.header, { paddingTop: safe.top + 8 }]} pointerEvents="box-none">
      <RoundButton icon="home" label="Home" size={46} onPress={onBack} sfx="whoosh" />
      <View style={{ alignItems: 'center' }} pointerEvents="none">
        <GameText size={20} font="cinemaBold" strokeWidth={0} style={s.headerTitle}>THE JOURNEY</GameText>
        <GameText size={10} font="cinemaBold" strokeWidth={0} style={{ color: ui.accent, letterSpacing: 3 }}>{chapters[chapter]!.world.toUpperCase()}</GameText>
      </View>
      <ShardPill total={total} />
    </View>
    <View style={[s.jump, { bottom: safe.bottom + 18 }]}>
      <RoundButton icon="locate" label="Jump to current level" size={52} onPress={() => ref.current?.scrollTo({ y: focusY(Math.min(next, levels.length)), animated: true })} />
    </View>
    <View style={[s.heartsTag, { bottom: safe.bottom + 28, borderColor: `${ui.accent}77` }]} pointerEvents="none">
      <Gem size={14} color={hearts.length ? chapters[hearts[hearts.length - 1]!]!.heartColor : 'gray'} />
      <GameText size={11} font="bold" strokeWidth={0} style={{ color: '#fff', letterSpacing: 1.5 }}>{`${hearts.length}/5 HEARTS`}</GameText>
    </View>
  </View>;
}

const shadow = { textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 } as const;
const s = StyleSheet.create({
  aura: { position: 'absolute' },
  medalWrap: { position: 'absolute', alignItems: 'center' },
  medal: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  gloss: { position: 'absolute', top: 2, left: '15%', right: '15%', height: '42%' },
  num: { color: '#fff', ...shadow },
  play: { marginTop: -4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: '#ffe08a', borderWidth: 1, borderColor: '#8a5a1e' },
  below: { alignItems: 'center', marginTop: -26 },
  shards: { flexDirection: 'row', alignItems: 'flex-end', gap: 1 },
  bossTag: { marginTop: 3, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, borderWidth: 1, backgroundColor: '#05081ad0' },
  gateCard: { position: 'absolute', left: 18, right: 18, alignItems: 'center' },
  story: { color: '#eef2fb', marginTop: 4, paddingHorizontal: 12, ...shadow },
  kicker: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 3, borderRadius: 10, backgroundColor: '#05081ab8' },
  gateStats: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1, backgroundColor: '#05081ad0' },
  statText: { color: '#fff' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#ffffff88' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 16, borderWidth: 1.5, backgroundColor: '#05081ae0' },
  footer: { position: 'absolute', left: 0, alignItems: 'center' },
  footerGems: { flexDirection: 'row', gap: 10 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  headerTitle: { color: '#fff', letterSpacing: 3, ...shadow },
  jump: { position: 'absolute', right: 16 },
  heartsTag: { position: 'absolute', left: 16, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 28, borderRadius: 14, borderWidth: 1, backgroundColor: '#05081ad0' },
  mote: { position: 'absolute', left: 0, top: 0, width: 14, height: 14, borderRadius: 7, shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  rain: { position: 'absolute', top: 0, width: 1.5, height: 26, backgroundColor: '#cfefffaa', borderRadius: 1 },
  snow: { position: 'absolute', top: 0, borderRadius: 10, backgroundColor: '#ffffffdd' },
  sand: { position: 'absolute', left: 0, width: 22, height: 2, borderRadius: 1, backgroundColor: '#ffe1a088' },
  star: { position: 'absolute', width: 3, height: 3, borderRadius: 2, backgroundColor: '#fff' },
  dust: { position: 'absolute', top: 0, width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff3c8' },
});
