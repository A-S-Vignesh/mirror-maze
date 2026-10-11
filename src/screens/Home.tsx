import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { chapters } from '../game/chapters';
import { Logo } from '../ui/Art';
import { PopIn, Pulse } from '../ui/Effects';
import { GameText } from '../ui/GameText';
import { RoundButton, ShardPill, ToyButton, useUI } from '../ui/Toy';

export function Home({ total, next, chapter, hearts, onPlay, onMap, onSettings }: {
  total: number; next: number; chapter: number; hearts: number[]; onPlay: () => void; onMap: () => void; onSettings: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const safe = useSafeAreaInsets();
  const { ui } = useUI();
  const c = chapters[chapter]!;
  const finished = next > 135;
  const logoW = Math.min(width * .84, 360, height * .4);
  return <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
    <LinearGradient pointerEvents="none" colors={['#000000a8', '#00000000']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: height * .36 }} />
    <LinearGradient pointerEvents="none" colors={['#00000000', '#000000c0']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: height * .38 }} />
    <View style={[s.top, { paddingTop: safe.top + 8 }]} pointerEvents="box-none">
      <RoundButton icon="settings-sharp" label="Settings" size={46} onPress={onSettings} />
      <ShardPill total={total} />
    </View>
    <View style={{ alignItems: 'center', marginTop: height < 720 ? -6 : 4 }} pointerEvents="none">
      <PopIn from={.6}><Logo width={logoW} /></PopIn>
    </View>
    <View style={{ flex: 1 }} pointerEvents="none" />
    <View style={[s.bottom, { paddingBottom: safe.bottom + 18 }]} pointerEvents="box-none">
      <View style={s.hearts} pointerEvents="none">
        <GameText size={12} font="cinemaBold" strokeWidth={0} style={{ color: ui.accent, letterSpacing: 4 }}>{`${hearts.length} OF 5 HEARTS FORGED`}</GameText>
      </View>
      <GameText size={13} font="bold" strokeWidth={0} style={s.chapter}>
        {!finished ? `Chapter ${c.number} · ${c.title}` : hearts.length === 5 ? 'The Void is sealed. Every world shines.' : 'Every world restored. Gather every shard to forge the Hearts.'}
      </GameText>
      <Pulse scale={1.03} duration={900}>
        <ToyButton title={finished ? 'JOURNEY MAP' : 'PLAY'} icon={finished ? 'map' : 'play'} height={64} fontSize={finished ? 22 : 26} onPress={onPlay} style={{ width: Math.min(width * .72, 320) }}
          label={finished ? 'Open the journey map' : `Play, level ${next}`} sfx="whoosh" />
      </Pulse>
      {!finished && <ToyButton title="JOURNEY MAP" icon="map" tint="secondary" height={46} fontSize={16} onPress={onMap} style={{ width: Math.min(width * .56, 250), marginTop: 12 }}
        label="Journey map" sfx="whoosh" />}
    </View>
  </View>;
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14 },
  bottom: { alignItems: 'center', paddingHorizontal: 20 },
  hearts: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12, backgroundColor: '#05081a99', marginBottom: 10 },
  chapter: { color: '#f0f3fb', marginBottom: 14, textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
});
