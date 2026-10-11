import React, { ReactNode, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { PopIn } from '../ui/Effects';
import { GameText } from '../ui/GameText';
import { ChapterUI, Panel, RoundButton, Toggle, ToyButton, useUI } from '../ui/Toy';
import { Settings as SettingsData } from '../services/storage';

function Popup({ title, onClose, children, chapter }: { title: string; onClose: () => void; children: ReactNode; chapter: number }) {
  const { width } = useWindowDimensions();
  return <Modal transparent animationType="fade" onRequestClose={onClose}>
    <ChapterUI.Provider value={chapter}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close popup" accessibilityRole="button" />
        <View style={{ width: Math.min(width - 36, 400) }} pointerEvents="box-none">
          <PopIn from={.94}><Body title={title} onClose={onClose}>{children}</Body></PopIn>
        </View>
      </View>
    </ChapterUI.Provider>
  </Modal>;
}
function Body({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { ui } = useUI();
  return <Panel>
    <View style={s.head}>
      <View style={{ width: 40 }} />
      <View style={{ flex: 1, alignItems: 'center' }}>
        <GameText size={22} font="cinemaBold" strokeWidth={0} style={{ color: '#fff', letterSpacing: 3 }}>{title}</GameText>
        <View style={[s.rule, { backgroundColor: ui.accent }]} />
      </View>
      <RoundButton icon="close" label="Close" size={40} onPress={onClose} />
    </View>
    {children}
  </Panel>;
}

type Change = (key: keyof SettingsData, value: boolean) => void;

export function SettingsModal({ chapter, settings, onChange, onClose, onReset, onStory }: {
  chapter: number; settings: SettingsData; onChange: Change; onClose: () => void; onReset: () => void; onStory: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return <Popup title={confirm ? 'ARE YOU SURE?' : 'SETTINGS'} onClose={onClose} chapter={chapter}>
    {confirm ? <View style={{ gap: 14 }}>
      <GameText size={16} font="semi" strokeWidth={0} style={{ color: '#eef2fb' }}>{'This erases every shard, Heart\nand opened world.'}</GameText>
      <ToyButton title="KEEP MY JOURNEY" height={52} fontSize={17} onPress={() => setConfirm(false)} />
      <ToyButton title="YES, RESET" tint="red" height={46} fontSize={16} label="Confirm reset progress" sfx="bonk" onPress={() => { onReset(); onClose(); }} />
    </View> : <View>
      <Toggle label="Sound effects" icon="volume-high" value={settings.sound} onChange={v => onChange('sound', v)} />
      <Toggle label="Music" icon="musical-notes" value={settings.music} onChange={v => onChange('music', v)} />
      <Toggle label="Narration" icon="mic" value={settings.voice} onChange={v => onChange('voice', v)} />
      <Toggle label="Vibration" icon="phone-portrait" value={settings.haptics} onChange={v => onChange('haptics', v)} />
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
        <ToyButton title="STORY" icon="film" tint="secondary" height={44} fontSize={15} style={{ flex: 1 }} label="Replay the story" onPress={() => { onClose(); onStory(); }} sfx="whoosh" />
        <ToyButton title="RESET" icon="trash" tint="red" height={44} fontSize={15} style={{ flex: 1 }} label="Reset progress" onPress={() => setConfirm(true)} />
      </View>
      <GameText size={11} font="semi" strokeWidth={0} style={{ color: '#aab4cc', marginTop: 14 }}>Mirror Maze · The Last Lightkeeper · v4.0</GameText>
    </View>}
  </Popup>;
}

export function PauseModal({ chapter, settings, onChange, onResume, onRestart, onHome, onMap }: {
  chapter: number; settings: SettingsData; onChange: Change; onResume: () => void; onRestart: () => void; onHome: () => void; onMap: () => void;
}) {
  return <Popup title="PAUSED" onClose={onResume} chapter={chapter}>
    <View style={{ gap: 14 }}>
      <ToyButton title="RESUME" icon="play" height={56} fontSize={20} onPress={onResume} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <ToyButton title="RESTART" icon="refresh" tint="secondary" height={46} fontSize={15} style={{ flex: 1 }} onPress={onRestart} />
        <ToyButton title="MAP" icon="map" tint="secondary" height={46} fontSize={15} style={{ flex: 1 }} onPress={onMap} sfx="whoosh" />
      </View>
      <ToyButton title="HOME" icon="home" tint="secondary" height={44} fontSize={15} onPress={onHome} sfx="whoosh" />
      <View>
        <Toggle label="Sound effects" icon="volume-high" value={settings.sound} onChange={v => onChange('sound', v)} />
        <Toggle label="Music" icon="musical-notes" value={settings.music} onChange={v => onChange('music', v)} />
      </View>
    </View>
  </Popup>;
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#03050fcc', alignItems: 'center', justifyContent: 'center', padding: 18 },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  rule: { width: 46, height: 2, borderRadius: 1, marginTop: 6 },
});
