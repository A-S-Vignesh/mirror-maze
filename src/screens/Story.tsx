import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chapters, ending } from '../game/chapters';
import { fitTitle, Gem, Logo, TitleArt } from '../ui/Art';
import { Confetti, Letterbox, PopIn, Slam, Typewriter } from '../ui/Effects';
import { fonts } from '../ui/fonts';
import { GameText } from '../ui/GameText';
import { ToyButton, useUI } from '../ui/Toy';
import { audio } from '../services/audio';
import { voice } from '../services/voice';

/** Caption start times that leave room for the narrator to finish each line. */
function schedule(lines: string[], from: number, min: number) {
  let at = from;
  const starts = lines.map(text => { const s = at; at += voice.pace(text, min); return s; });
  return { starts, end: at };
}

const shadow = { textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 } as const;

function Skip({ onPress, label }: { onPress: () => void; label: string }) {
  const safe = useSafeAreaInsets();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { audio.play('pop'); onPress(); }}
    style={[s.skip, { top: safe.top + 14 }]} hitSlop={10}>
    <GameText size={14} font="cinemaBold" strokeWidth={0} style={{ color: '#fff', letterSpacing: 2 }}>SKIP ›</GameText>
  </Pressable>;
}

/** World cleared: a beacon rises from the final board and the road to the next world opens. */
export function Outro({ chapter, hearts, onDone }: { chapter: number; hearts: number[]; onDone: () => void }) {
  const { width } = useWindowDimensions();
  const safe = useSafeAreaInsets();
  const { ui } = useUI();
  const c = chapters[chapter]!;
  const [stage, setStage] = useState(0);
  const [line, setLine] = useState(-1);
  useEffect(() => {
    audio.setDuck(.3);
    audio.play('heart', .8);
    audio.haptic('success');
    const { starts, end } = schedule(c.outro, 4000, 2700);
    const timers = [
      setTimeout(() => setStage(1), 2600),
      ...starts.map((at, i) => setTimeout(() => setLine(i), at)),
      setTimeout(() => { setStage(2); audio.setDuck(1); }, end),
    ];
    return () => { timers.forEach(clearTimeout); audio.setDuck(1); };
  }, [c]);
  const forged = hearts.includes(chapter);
  return <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
    <Letterbox show={stage < 2} />
    {stage >= 1 && <View style={[s.title, { top: safe.top + 70 }]} pointerEvents="none">
      <Slam onImpact={() => audio.play('boom', .6)}>
        <GameText size={13} font="cinemaBold" strokeWidth={0} style={{ color: ui.accent, letterSpacing: 5, textAlign: 'center' }}>{`CHAPTER ${c.number} COMPLETE`}</GameText>
        <TitleArt lines={[c.title.toUpperCase()]} width={Math.min(width - 30, 440)} size={fitTitle(c.title, Math.min(width - 30, 440), 40)} fill={ui.title} stroke={ui.titleStroke} font={fonts.cinemaBold} />
      </Slam>
    </View>}
    <View style={[s.caption, { bottom: '17%' }]} pointerEvents="none">{line >= 0 && stage < 2 && <Typewriter key={line} text={c.outro[line]!} size={Math.min(23, width * .058)} />}</View>
    {stage >= 2 && <View style={[s.action, { bottom: safe.bottom + 40 }]} pointerEvents="box-none"><PopIn>
      <View style={[s.note, { borderColor: `${c.heartColor}88` }]}>
        <Gem size={30} color={forged ? c.heartColor : 'gray'} />
        <GameText size={14} font="semi" strokeWidth={0} align="left" containerStyle={{ flex: 1 }} style={{ color: '#fff' }}>
          {forged ? `The ${c.heart} is already yours.` : `Earn all 3 shards on every level here to forge the ${c.heart}.`}
        </GameText>
      </View>
      <ToyButton title={chapter === 4 ? 'TO THE JOURNEY' : 'ONWARD'} icon="arrow-forward" height={60} fontSize={22} style={{ width: Math.min(width * .78, 320), alignSelf: 'center' }}
        onPress={onDone} sfx="whoosh" label="Continue the story" />
    </PopIn></View>}
  </View>;
}

/** Every shard of a world gathered: its Heart rises, then flies into the Lightkeeper's Amulet. Timed to the 3D Amulet (socket at 3.7s). */
export function Forge({ chapter, total, onDone }: { chapter: number; total: number; onDone: () => void }) {
  const { width } = useWindowDimensions();
  const safe = useSafeAreaInsets();
  const c = chapters[chapter]!;
  const [line, setLine] = useState(-1);
  const [title, setTitle] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    audio.setDuck(.25);
    audio.play('riser', .7);
    const timers = [
      setTimeout(() => setLine(0), 500),
      setTimeout(() => audio.play('charge'), 1900),
      setTimeout(() => { setLine(-1); setTitle(true); audio.play('heart'); audio.haptic('success'); }, 3700),
      setTimeout(() => setLine(1), 5200),
      setTimeout(() => { setReady(true); audio.setDuck(1); }, 7400),
    ];
    return () => { timers.forEach(clearTimeout); audio.setDuck(1); };
  }, []);
  return <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
    <Letterbox show={!ready} />
    {title && <View style={[s.title, { top: safe.top + 60 }]} pointerEvents="none">
      <Slam onImpact={() => audio.play('boom', .7)}>
        <TitleArt lines={[c.heart.toUpperCase(), 'FORGED']} width={Math.min(width - 30, 420)} size={44}
          fill={['#ffffff', c.heartColor, c.heartColor]} stroke="#0a0614" font={fonts.cinemaBold} />
      </Slam>
      <GameText size={14} font="cinemaBold" strokeWidth={0} style={{ color: '#fff', letterSpacing: 3, ...shadow }}>{`${total} OF 5 HEARTS`}</GameText>
    </View>}
    {title && <Confetti count={26} colors={[c.heartColor, '#ffffff', '#ffe08a']} />}
    <View style={[s.caption, { bottom: '15%' }]} pointerEvents="none">{line >= 0 && <Typewriter key={line} text={c.forge[line]!} size={Math.min(23, width * .058)} />}</View>
    {ready && <View style={[s.action, { bottom: safe.bottom + 40 }]} pointerEvents="box-none"><PopIn>
      <ToyButton title={total === 5 ? 'SEAL THE VOID' : 'CONTINUE'} icon={total === 5 ? 'flash' : 'arrow-forward'} height={60} fontSize={22}
        style={{ width: Math.min(width * .78, 320), alignSelf: 'center' }} onPress={onDone} sfx="whoosh" label="Continue the story" />
    </PopIn></View>}
  </View>;
}

/** The five Hearts reunite the Great Prism and the Void Eye closes. Timed to the 3D Amulet (prism whole at 4.4s). */
export function Ending({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const safe = useSafeAreaInsets();
  const [line, setLine] = useState(-1);
  const [fin, setFin] = useState(false);
  const done = useRef(false);
  const finish = () => { if (!done.current) { done.current = true; setFin(true); audio.play('win'); } };
  useEffect(() => {
    audio.setDuck(.3);
    audio.play('riser');
    const { starts, end } = schedule(ending, 1000, 3300);
    const timers = [
      setTimeout(() => { audio.play('heart'); audio.haptic('heavy'); }, 4400),
      ...starts.map((at, i) => setTimeout(() => setLine(i), at)),
      setTimeout(finish, end),
    ];
    return () => { timers.forEach(clearTimeout); audio.setDuck(1); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
    <Letterbox show={!fin} />
    <View style={[s.caption, { bottom: '15%' }]} pointerEvents="none">{line >= 0 && !fin && <Typewriter key={line} text={ending[line]!} size={Math.min(23, width * .058)} />}</View>
    {fin && <>
      <Confetti colors={chapters.map(c => c.heartColor)} />
      <View style={[s.fin, { paddingTop: safe.top + 30 }]} pointerEvents="box-none">
        <PopIn from={.4}><Logo width={Math.min(width * .84, 380)} /></PopIn>
        <View style={{ flex: 1 }} pointerEvents="none" />
        <GameText size={30} font="cinemaBold" strokeWidth={0} style={{ color: '#fff', letterSpacing: 6, ...shadow }}>THE END</GameText>
        <GameText size={14} font="semi" strokeWidth={0} style={{ color: '#eef2fb', marginTop: 6, marginBottom: 20, ...shadow }}>Five Hearts. One Prism. Thank you, Lightkeeper.</GameText>
        <ToyButton title="HOME" icon="home" height={56} fontSize={20} style={{ width: 240, marginBottom: safe.bottom + 30 }} onPress={onDone} sfx="whoosh" />
      </View>
    </>}
    {!fin && <Skip onPress={finish} label="Skip ending" />}
  </View>;
}

const s = StyleSheet.create({
  title: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 6 },
  caption: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  action: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 16 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 24, marginBottom: 16, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, backgroundColor: '#05081ad8', maxWidth: 420 },
  fin: { flex: 1, alignItems: 'center' },
  skip: { position: 'absolute', right: 16, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#00000077', borderWidth: 1, borderColor: '#ffffff33' },
});
