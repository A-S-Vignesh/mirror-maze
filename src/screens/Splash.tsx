import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Logo } from '../ui/Art';
import { GameText } from '../ui/GameText';
import { PopIn, Vignette } from '../ui/Effects';

const tips = ['Tap a mirror to bend the light', 'Every move counts for stars', 'Five worlds. Five Hearts. One Lightkeeper.'];

export function Splash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const { width } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const done = useRef(false);
  const [tip] = useState(() => tips[Math.floor(Math.random() * tips.length)]!);
  useEffect(() => { Animated.timing(progress, { toValue: .8, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: false }).start(); }, [progress]);
  useEffect(() => {
    if (!ready) return;
    Animated.timing(progress, { toValue: 1, duration: 600, delay: 700, useNativeDriver: false }).start(() => { if (!done.current) { done.current = true; onDone(); } });
  }, [ready, progress, onDone]);
  const bar = Math.min(width * .66, 300);
  return <View style={s.root} pointerEvents="box-none">
    <Vignette strength={.6} top={.3} bottom={.4} />
    <View style={{ flex: 1 }} />
    <PopIn from={.2}><Logo width={Math.min(width * .9, 420)} /></PopIn>
    <View style={{ flex: 1.2 }} />
    <View style={[s.track, { width: bar }]}>
      <Animated.View style={{ width: progress.interpolate({ inputRange: [0, 1], outputRange: [0, bar - 10] }), height: '100%', borderRadius: 10, overflow: 'hidden' }}>
        <LinearGradient colors={['#fff7a8', '#ffcf2a', '#ff9a0a']} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
    <GameText size={15} font="bold" strokeWidth={2.4} stroke="#000" containerStyle={{ marginTop: 10, marginBottom: Platform.OS === 'web' ? 36 : 52 }}>{tip}</GameText>
  </View>;
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  track: { height: 22, borderRadius: 12, padding: 3, backgroundColor: '#000000aa', borderWidth: 2, borderColor: '#ffe9a0' },
});
