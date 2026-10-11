import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { prologue } from '../game/chapters';
import { Logo } from '../ui/Art';
import { GameText } from '../ui/GameText';
import { Letterbox, PopIn, Typewriter } from '../ui/Effects';
import { audio } from '../services/audio';

/**
 * Timed to the 3D prologue (the Prism shatters at 12.8s) and to the recorded narration,
 * so every line is fully spoken before the next begins.
 */
const beats = [.6, 4.6, 10.6, 12.9, 17.9];
const END = 24.2;

export function Prologue({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const [line, setLine] = useState(-1);
  const [title, setTitle] = useState(false);
  const finished = useRef(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const finish = () => { if (!finished.current) { finished.current = true; audio.setDuck(1); doneRef.current(); } };
  useEffect(() => {
    audio.setDuck(.35);
    const timers = [
      ...beats.map((at, i) => setTimeout(() => setLine(i), at * 1000)),
      setTimeout(() => audio.play('riser'), 10.6 * 1000),
      setTimeout(() => { audio.play('boom'); audio.haptic('heavy'); }, 12.8 * 1000),
      setTimeout(() => { setLine(-1); setTitle(true); audio.play('heart', .7); }, END * 1000),
      setTimeout(finish, (END + 3.2) * 1000),
    ];
    return () => { timers.forEach(clearTimeout); audio.setDuck(1); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
    <Letterbox show={!title} />
    <View style={s.caption} pointerEvents="none">
      {line >= 0 && <Typewriter key={line} text={prologue[line]!} size={Math.min(26, width * .065)} />}
    </View>
    {title && <View style={s.title} pointerEvents="none"><PopIn from={.2}><Logo width={Math.min(width * .9, 420)} /></PopIn></View>}
    <Pressable accessibilityRole="button" accessibilityLabel="Skip story" onPress={() => { audio.play('pop'); finish(); }} style={s.skip} hitSlop={10}>
      <GameText size={16} font="bold" strokeWidth={2} stroke="#000">SKIP ›</GameText>
    </Pressable>
  </View>;
}

const s = StyleSheet.create({
  caption: { position: 'absolute', left: 24, right: 24, bottom: '16%', alignItems: 'center' },
  title: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  skip: { position: 'absolute', top: 16, right: 18, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#00000066' },
});
