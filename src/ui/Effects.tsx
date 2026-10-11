import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GameText } from './GameText';
import { audio } from '../services/audio';
import { voice } from '../services/voice';

const nativeDriver = Platform.OS !== 'web';

/** Darkened top and bottom edges keep HUD text readable over any 3D scene. */
export function Vignette({ strength = .55, top = .22, bottom = .3 }: { strength?: number; top?: number; bottom?: number }) {
  const a = Math.round(strength * 255).toString(16).padStart(2, '0');
  return <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <LinearGradient colors={[`#000000${a}`, '#00000000']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${top * 100}%` }} />
    <LinearGradient colors={['#00000000', `#000000${a}`]} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${bottom * 100}%` }} />
  </View>;
}

export function Letterbox({ show }: { show: boolean }) {
  const { height } = useWindowDimensions();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: show ? 1 : 0, duration: 600, easing: Easing.inOut(Easing.cubic), useNativeDriver: nativeDriver }).start(); }, [show, v]);
  const bar = height * .11;
  return <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <Animated.View style={[s.bar, { top: 0, height: bar, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-bar, 0] }) }] }]} />
    <Animated.View style={[s.bar, { bottom: 0, height: bar, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [bar, 0] }) }] }]} />
  </View>;
}

/** Cutscene caption revealed word by word, and read aloud by the narrator. */
export function Typewriter({ text, size = 24, speed = 110, color = '#ffffff', stroke = '#000000', onDone, narrate = true }: {
  text: string; size?: number; speed?: number; color?: string; stroke?: string; onDone?: () => void; narrate?: boolean;
}) {
  const words = text.split(' ');
  const [shown, setShown] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => { if (narrate) voice.say(text); }, [text, narrate]);
  useEffect(() => {
    setShown(0);
    let i = 0;
    const spoken = narrate && voice.speaks(text);
    // Words appear at the narrator's pace; the typing tick is only used when the caption is silent.
    const delay = narrate ? voice.wordDelay(text, speed) : speed;
    const timer = setInterval(() => {
      i++;
      setShown(i);
      if (!spoken) audio.play('type', .3);
      if (i >= words.length) { clearInterval(timer); done.current?.(); }
    }, delay);
    return () => clearInterval(timer);
  }, [text, speed, words.length, narrate]);
  return <View accessible accessibilityLabel={text} accessibilityLiveRegion="polite" style={s.words}>
    {words.map((w, i) => <View key={i} style={{ opacity: i < shown ? 1 : 0 }}>
      <GameText size={size} font="bold" color={color} stroke={stroke} strokeWidth={3} style={{ lineHeight: size * 1.32 }}>{w}</GameText>
    </View>)}
  </View>;
}
export function Slam({ children, delay = 0, onImpact }: { children: ReactNode; delay?: number; onImpact?: () => void }) {
  const v = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const impact = useRef(onImpact);
  impact.current = onImpact;
  useEffect(() => {
    const t = setTimeout(() => impact.current?.(), delay + 260);
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration: 280, easing: Easing.in(Easing.cubic), useNativeDriver: nativeDriver }),
      Animated.sequence([10, -8, 6, -4, 2, 0].map(x => Animated.timing(shake, { toValue: x, duration: 45, useNativeDriver: nativeDriver }))),
    ]).start();
    return () => clearTimeout(t);
  }, [v, shake, delay]);
  return <Animated.View style={{ opacity: v.interpolate({ inputRange: [0, .3, 1], outputRange: [0, 1, 1] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [2.6, 1] }) }, { translateX: shake }, { translateY: Animated.multiply(shake, .5) }] }}>{children}</Animated.View>;
}

export function Curtain({ visible, color = '#000000', duration = 450 }: { visible: boolean; color?: string; duration?: number }) {
  const v = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => { Animated.timing(v, { toValue: visible ? 1 : 0, duration, useNativeDriver: nativeDriver }).start(); }, [visible, v, duration]);
  return <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: v }]} />;
}

const confettiColors = ['#ff4fc3', '#ffd84a', '#3fb4ff', '#5fe04a', '#b166ff', '#ff7a12', '#ffffff'];
function Piece({ index, width, height, colors }: { index: number; width: number; height: number; colors: string[] }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.timing(t, { toValue: 1, duration: 2600 + (index % 7) * 300, delay: (index % 12) * 90, easing: Easing.in(Easing.quad), useNativeDriver: nativeDriver }));
    anim.start();
    return () => anim.stop();
  }, [t, index]);
  return <Animated.View pointerEvents="none" style={{
    position: 'absolute', left: ((index * 37) % 100) / 100 * width, top: -20, width: 8 + (index % 3) * 3, height: 14 - (index % 3) * 2, borderRadius: 2,
    backgroundColor: colors[index % colors.length],
    transform: [
      { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, height + 40] }) },
      { translateX: t.interpolate({ inputRange: [0, .3, .6, 1], outputRange: [0, 22, -18, 10].map(v => v * (index % 2 ? 1 : -1)) }) },
      { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(index % 2 ? 1 : -1) * (360 + index * 20)}deg`] }) },
    ],
  }} />;
}
export function Confetti({ count = 40, colors = confettiColors }: { count?: number; colors?: string[] }) {
  const { width, height } = useWindowDimensions();
  return <View style={StyleSheet.absoluteFill} pointerEvents="none">
    {Array.from({ length: count }, (_, i) => <Piece key={i} index={i} width={width} height={height} colors={colors} />)}
  </View>;
}

export function PopIn({ children, delay = 0, from = .3 }: { children: ReactNode; delay?: number; from?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([Animated.delay(delay), Animated.spring(v, { toValue: 1, friction: 5, tension: 120, useNativeDriver: nativeDriver })]).start();
  }, [v, delay]);
  return <Animated.View style={{ opacity: v.interpolate({ inputRange: [0, .2, 1], outputRange: [0, 1, 1] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [from, 1] }) }] }}>{children}</Animated.View>;
}

export function SlideIn({ children, delay = 0, from = 40, hideAfter }: { children: ReactNode; delay?: number; from?: number; hideAfter?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const steps = [Animated.delay(delay), Animated.timing(v, { toValue: 1, duration: 420, easing: Easing.out(Easing.back(1.4)), useNativeDriver: nativeDriver })];
    if (hideAfter) steps.push(Animated.delay(hideAfter), Animated.timing(v, { toValue: 0, duration: 380, easing: Easing.in(Easing.cubic), useNativeDriver: nativeDriver }));
    Animated.sequence(steps).start();
  }, [v, delay, hideAfter]);
  return <Animated.View pointerEvents="box-none" style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] }}>{children}</Animated.View>;
}

function loopAnim(v: Animated.Value, duration: number) {
  return Animated.loop(Animated.sequence([
    Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver }),
    Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: nativeDriver }),
  ]));
}
export function Bob({ children, distance = 6, duration = 1200 }: { children: ReactNode; distance?: number; duration?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { const l = loopAnim(v, duration); l.start(); return () => l.stop(); }, [v, duration]);
  return <Animated.View style={{ transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -distance] }) }] }}>{children}</Animated.View>;
}
export function Pulse({ children, scale = 1.06, duration = 700 }: { children: ReactNode; scale?: number; duration?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { const l = loopAnim(v, duration); l.start(); return () => l.stop(); }, [v, duration]);
  return <Animated.View style={{ transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, scale] }) }] }}>{children}</Animated.View>;
}

const s = StyleSheet.create({ bar: { position: 'absolute', left: 0, right: 0, backgroundColor: '#000' }, words: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 7 } });
