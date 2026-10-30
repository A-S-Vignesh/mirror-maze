import React, { useMemo, useRef, useState } from 'react';
import { AccessibilityActionEvent, Animated, NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PopIn, Vignette } from '../ui/Effects';
import { GameText } from '../ui/GameText';
import { Panel, ToyButton, useUI } from '../ui/Toy';
import { audio } from '../services/audio';
import { birthYears } from '../game/age';

const ROW = 52;
const VISIBLE = 5;
const nativeDriver = Platform.OS !== 'web';

/**
 * The first-launch age screen (Google Play Families policy): a year wheel. It is neutral on purpose, as COPPA requires:
 * it starts on an empty row rather than a default year, and nothing hints at which answer unlocks what, so players have
 * no reason to give a false year. Continue unlocks once a year sits in the centre.
 */
export function AgeGate({ onDone }: { onDone: (birthYear: number) => void }) {
  const { width } = useWindowDimensions();
  const { ui } = useUI();
  /** The empty row first, then the years, newest first. */
  const rows = useMemo<(number | undefined)[]>(() => [undefined, ...birthYears()], []);
  const [index, setIndex] = useState(0);
  const offset = useRef(new Animated.Value(0)).current;
  const wheel = useRef<ScrollView>(null);
  const chosen = rows[index];

  const clamp = (i: number) => Math.max(0, Math.min(rows.length - 1, i));
  const scrollTo = (i: number) => wheel.current?.scrollTo({ y: clamp(i) * ROW, animated: true });
  const settleAt = (y: number) => {
    const i = clamp(Math.round(y / ROW));
    setIndex(previous => {
      if (i !== previous && rows[i] !== undefined) audio.haptic();
      return i;
    });
  };
  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => settleAt(event.nativeEvent.contentOffset.y);
  // Browsers send no momentum events, so on the web the wheel settles (and snaps to a row) once scrolling stops.
  const webStop = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onWebScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (Platform.OS !== 'web') return;
    const y = event.nativeEvent.contentOffset.y;
    clearTimeout(webStop.current);
    webStop.current = setTimeout(() => { settleAt(y); scrollTo(Math.round(y / ROW)); }, 140);
  };
  // Screen readers adjust the wheel by swiping up and down, one year at a time.
  const adjust = (event: AccessibilityActionEvent) => {
    const i = clamp(index + (event.nativeEvent.actionName === 'increment' ? 1 : -1));
    setIndex(i);
    scrollTo(i);
  };

  return <View style={s.root}>
    <Vignette strength={.7} top={.35} bottom={.45} />
    <View style={{ width: Math.min(width - 32, 400) }}>
      <PopIn from={.94}>
        <Panel>
          <View style={s.head} accessible accessibilityRole="header" accessibilityLabel="Welcome, Lightkeeper">
            <GameText size={21} font="cinemaBold" strokeWidth={0} style={{ letterSpacing: 2.5 }}>WELCOME, LIGHTKEEPER</GameText>
            <View style={[s.rule, { backgroundColor: ui.accent }]} />
          </View>
          <GameText size={17} font="semi" strokeWidth={0} color="#eef2fb">What year were you born?</GameText>

          <View style={[s.wheel, { height: ROW * VISIBLE }]} accessible accessibilityRole="adjustable" accessibilityLabel="Year of birth"
            accessibilityValue={{ text: chosen === undefined ? 'Not chosen yet' : String(chosen) }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={adjust}>
            <View pointerEvents="none" style={[s.band, { top: ROW * 2, height: ROW, borderColor: ui.accent, backgroundColor: `${ui.accent}1f` }]} />
            <Animated.ScrollView ref={wheel} showsVerticalScrollIndicator={false} snapToInterval={ROW} decelerationRate="fast"
              contentContainerStyle={{ paddingVertical: ROW * 2 }} scrollEventThrottle={16}
              onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: offset } } }], { useNativeDriver: nativeDriver, listener: onWebScroll })}
              onMomentumScrollEnd={settle} onScrollEndDrag={settle}>
              {rows.map((year, i) => {
                const near = [(i - 2) * ROW, i * ROW, (i + 2) * ROW];
                const opacity = offset.interpolate({ inputRange: near, outputRange: [.3, 1, .3], extrapolate: 'clamp' });
                const scale = offset.interpolate({ inputRange: near, outputRange: [.78, 1, .78], extrapolate: 'clamp' });
                return <Pressable key={year ?? 'empty'} onPress={() => scrollTo(i)} style={s.row} importantForAccessibility="no-hide-descendants">
                  <Animated.View style={{ opacity, transform: [{ scale }] }}>
                    <GameText size={24} font="bold" strokeWidth={2.5} stroke="#000" color="#ffffff">{year === undefined ? '– – – –' : String(year)}</GameText>
                  </Animated.View>
                </Pressable>;
              })}
            </Animated.ScrollView>
            <LinearGradient pointerEvents="none" colors={['#000000a0', '#00000000']} style={[s.fade, { top: 0 }]} />
            <LinearGradient pointerEvents="none" colors={['#00000000', '#000000a0']} style={[s.fade, { bottom: 0 }]} />
          </View>

          <ToyButton title="CONTINUE" height={54} fontSize={18} style={{ marginTop: 16 }} disabled={chosen === undefined}
            label={chosen === undefined ? 'Continue, choose your year of birth first' : `Continue with ${chosen}`}
            onPress={() => { if (chosen !== undefined) onDone(chosen); }} />
        </Panel>
      </PopIn>
    </View>
  </View>;
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  head: { alignItems: 'center', marginBottom: 12 },
  rule: { width: 46, height: 2, borderRadius: 1, marginTop: 6 },
  wheel: { marginTop: 14, borderRadius: 18, borderWidth: 1.5, borderColor: '#ffffff26', backgroundColor: '#00000047', overflow: 'hidden' },
  band: { position: 'absolute', left: 10, right: 10, borderRadius: 14, borderWidth: 1.5 },
  row: { height: ROW, alignItems: 'center', justifyContent: 'center' },
  fade: { position: 'absolute', left: 0, right: 0, height: ROW * 1.6 },
});
