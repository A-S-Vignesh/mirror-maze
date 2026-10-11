import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { MapScroll, World, WorldMode } from './src/world/World';
import { BEAM_SPEED } from './src/world/Beam';
import { CHARGE_TIME } from './src/world/Crystal';
import { Curtain } from './src/ui/Effects';
import { GameText } from './src/ui/GameText';
import { ChapterUI, Panel, ToyButton } from './src/ui/Toy';
import { Splash } from './src/screens/Splash';
import { Prologue } from './src/screens/Prologue';
import { Home } from './src/screens/Home';
import { JourneyMap, StoryKind } from './src/screens/Map';
import { ChapterIntro } from './src/screens/ChapterIntro';
import { Gameplay, HUD_BOTTOM, HUD_TOP } from './src/screens/Gameplay';
import { Complete, Fail } from './src/screens/Complete';
import { Ending, Forge, Outro } from './src/screens/Story';
import { PauseModal, SettingsModal } from './src/screens/Modals';
import { useSave } from './src/services/useSave';
import { audio } from './src/services/audio';
import { ads } from './src/services/ads';
import { voice } from './src/services/voice';
import { heartsEarned, recordResult, SHARDS_PER_WORLD, totalShards, unlockedLevel, worldShards } from './src/game/progress';
import { levels } from './src/game/levels';
import { chapterOf, firstLevelOf, LEVELS_PER_CHAPTER } from './src/game/chapters';
import { applyMove, canRotate, initialState, solve, starsFor, traceState } from './src/game/engine';
import { PlayState } from './src/game/types';

type Screen = 'splash' | 'prologue' | 'home' | 'map' | 'intro' | 'game' | 'complete' | 'fail' | 'outro' | 'forge' | 'ending';
const worldMode: Record<Screen, WorldMode> = {
  splash: 'splash', prologue: 'prologue', home: 'menu', map: 'map', intro: 'intro', game: 'game',
  complete: 'complete', fail: 'fail', outro: 'outro', forge: 'forge', ending: 'ending',
};
const cinematic: Screen[] = ['splash', 'prologue', 'intro'];
interface Win { moves: number; stars: number; before: number; after: number }
interface Snapshot { play: PlayState; moves: number }

function GameApp() {
  const [fontsLoaded, fontError] = useFonts({
    Lilita: require('@expo-google-fonts/lilita-one/400Regular/LilitaOne_400Regular.ttf'),
    FredokaBold: require('@expo-google-fonts/fredoka/700Bold/Fredoka_700Bold.ttf'),
    FredokaSemi: require('@expo-google-fonts/fredoka/600SemiBold/Fredoka_600SemiBold.ttf'),
    Cinzel: require('@expo-google-fonts/cinzel/900Black/Cinzel_900Black.ttf'),
    CinzelBold: require('@expo-google-fonts/cinzel/700Bold/Cinzel_700Bold.ttf'),
  });
  const safe = useSafeAreaInsets();
  const save = useSave();
  const [screen, setScreen] = useState<Screen>('splash');
  const [modal, setModal] = useState<'settings' | 'pause'>();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [levelId, setLevelId] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [play, setPlay] = useState<PlayState>(() => initialState(levels[0]!));
  const [moves, setMoves] = useState(0);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [hint, setHint] = useState<string>();
  const [win, setWin] = useState<Win>();
  const [celebrate, setCelebrate] = useState(false);
  const [mapChapter, setMapChapter] = useState(0);
  const [mapFocus, setMapFocus] = useState(1);
  const [forging, setForging] = useState<number>();
  const [notice, setNotice] = useState<string>();
  const [curtain, setCurtain] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [view, setView] = useState<'tilt' | 'top'>('tilt');
  /** A cutscene being re-watched from the journey map; when it ends the player returns to the map. */
  const [replay, setReplay] = useState<{ kind: StoryKind; chapter: number }>();
  const mapScroll = useMemo<MapScroll>(() => ({ progress: 0 }), []);
  const lock = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const progress = save.data.progress;
  const seen = save.data.seen;
  const next = unlockedLevel(progress, levels.length + 1);
  const total = totalShards(progress);
  const hearts = useMemo(() => heartsEarned(progress), [progress]);
  const level = levels[levelId - 1]!;
  const playing = ['game', 'complete', 'fail', 'outro', 'intro'].includes(screen) && !replay;
  const homeChapter = chapterOf(Math.min(next, levels.length));
  const worldChapter = replay ? replay.chapter : playing ? level.chapter : screen === 'map' ? mapChapter : screen === 'forge' && forging !== undefined ? forging : homeChapter;
  const insets = useMemo(() => ({ top: safe.top + HUD_TOP, bottom: safe.bottom + HUD_BOTTOM }), [safe.top, safe.bottom]);

  const boardLevel = useMemo(() => {
    if (playing) return level;
    const first = firstLevelOf(worldChapter);
    return levels[Math.min(Math.max(next, first), first + LEVELS_PER_CHAPTER - 1) - 1]!;
  }, [playing, level, worldChapter, next]);
  const boardState = useMemo(() => (playing ? play : initialState(boardLevel)), [playing, play, boardLevel]);
  const trace = useMemo(() => traceState(boardLevel, boardState), [boardLevel, boardState]);
  const won = playing && trace.won;

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const later = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)); };
  const go = useCallback((s: Screen) => { setModal(undefined); setScreen(s); }, []);

  useEffect(() => { audio.init(); audio.onFailure(setNotice); return () => audio.dispose(); }, []);
  useEffect(() => { ads.setPauseHooks({ pause: () => setActive(false), resume: () => setActive(AppState.currentState === 'active') }); return () => ads.setPauseHooks(undefined); }, []);
  useEffect(() => { audio.configure(save.data.settings, active && save.loaded); }, [save.data.settings, active, save.loaded]);
  useEffect(() => { voice.configure(save.data.settings.voice && active); }, [save.data.settings.voice, active]);
  // Narration belongs to cutscenes only; leaving one silences the narrator.
  useEffect(() => { if (!['prologue', 'intro', 'outro', 'forge', 'ending'].includes(screen)) voice.stop(); }, [screen]);
  useEffect(() => { audio.setChapter(screen === 'prologue' || screen === 'ending' ? 4 : worldChapter); }, [worldChapter, screen]);
  // Outside the map, switching worlds dips briefly to black; the map hides the swap behind its chapter veils instead.
  const lastWorld = useRef(worldChapter);
  useEffect(() => {
    if (lastWorld.current === worldChapter) return;
    lastWorld.current = worldChapter;
    if (screen === 'map') return;
    setCurtain(true);
    const t = setTimeout(() => setCurtain(false), 360);
    return () => clearTimeout(t);
  }, [worldChapter, screen]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => { setActive(s === 'active'); if (s !== 'active' && screen === 'game') setModal('pause'); });
    return () => sub.remove();
  }, [screen]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (modal) { setModal(undefined); return true; }
      if (screen === 'game') { setModal('pause'); return true; }
      if (screen !== 'home' && screen !== 'splash') { go('home'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [screen, modal, go]);
  useEffect(() => () => clearTimers(), []);

  const begin = (id: number) => {
    clearTimers();
    const l = levels[id - 1]!;
    setLevelId(id); setPlay(initialState(l)); setMoves(0); setHistory([]); setCelebrate(false);
    setHint(id <= 2 ? solve(l, initialState(l))?.[0] : undefined);
    setWin(undefined); setAttempt(a => a + 1); lock.current = 0;
  };
  const start = (id: number, allowIntro = true) => {
    if (id < 1 || id > Math.min(next, levels.length)) { audio.play('bonk'); return; }
    const l = levels[id - 1]!;
    begin(id);
    if (allowIntro && l.index === 1 && !seen.intros.includes(l.chapter)) go('intro');
    else go('game');
  };
  const openMap = (focus = Math.min(next, levels.length)) => { setMapFocus(focus); setMapChapter(chapterOf(focus)); go('map'); };
  const finishLevel = (state: PlayState, used: number) => {
    if (!traceState(level, state).won) { console.error('Rejected unverified completion', levelId); return; }
    const stars = starsFor(level, used);
    const before = worldShards(progress, level.chapter);
    const after = worldShards(recordResult(progress, levelId, stars, used), level.chapter);
    save.complete(levelId, stars, used);
    setWin({ moves: used, stars, before, after });
    go('complete');
  };
  const rotate = (id: string) => {
    if (screen !== 'game' || modal || win || Date.now() < lock.current) return;
    if (!canRotate(level, play, id)) { audio.play('bonk'); audio.haptic('error'); return; }
    if (moves >= level.maxMoves) return;
    lock.current = Date.now() + 160;
    const nextState = applyMove(level, play, id);
    const used = moves + 1;
    setHistory(h => [...h, { play, moves }]);
    setPlay(nextState); setMoves(used);
    setHint(undefined);
    audio.play(id.startsWith('e') ? 'turn' : 'rotate'); audio.play('zap'); audio.haptic();
    const t = traceState(level, nextState);
    if (t.won) {
      lock.current = Number.MAX_SAFE_INTEGER;
      const travel = Math.max(...Object.values(t.activatedAt)) / BEAM_SPEED;
      later(travel * 1000, () => { audio.play('charge'); audio.haptic(); });
      later((travel + CHARGE_TIME) * 1000, () => { audio.play('win'); audio.haptic('success'); setCelebrate(true); });
      later((travel + CHARGE_TIME + 1.5) * 1000, () => finishLevel(nextState, used));
    } else {
      const left = level.maxMoves - used;
      if (left <= 0) { lock.current = Number.MAX_SAFE_INTEGER; later(900, () => go('fail')); }
    }
  };
  const undo = () => {
    if (screen !== 'game' || win || !history.length || lock.current > Date.now() + 1000) return;
    const last = history[history.length - 1]!;
    setHistory(h => h.slice(0, -1));
    setPlay(last.play); setMoves(last.moves);
    audio.play('rotate', .6); audio.haptic();
  };
  const showHint = () => {
    if (screen !== 'game' || win) return;
    const path = solve(level, play);
    if (path?.length) setHint(path[0]);
  };
  const newHeart = () => worldShards(progress, level.chapter) === SHARDS_PER_WORLD && !seen.hearts.includes(level.chapter);
  const advance = () => {
    if (level.index === LEVELS_PER_CHAPTER && !seen.outros.includes(level.chapter)) { go('outro'); return; }
    if (levelId >= levels.length) { openMap(levels.length); return; }
    const proceed = () => start(levelId + 1);
    if (ads.isDue(save.data.levelsSinceAd)) { save.resetAdCounter(); void ads.show().then(proceed); } else proceed();
  };
  const continueAfterWin = () => {
    if (newHeart()) { setForging(level.chapter); go('forge'); return; }
    advance();
  };
  const afterForge = () => {
    if (forging !== undefined) save.markSeen('hearts', forging);
    if (hearts.length === 5 && !seen.ending) { go('ending'); return; }
    setForging(undefined);
    advance();
  };
  const afterOutro = () => {
    save.markSeen('outros', level.chapter);
    if (level.chapter === 4) openMap(levels.length); else start(levelId + 1);
  };
  const watch = (kind: StoryKind, chapter: number) => {
    audio.play('whoosh');
    setReplay({ kind, chapter });
    if (kind === 'forge') setForging(chapter);
    go(kind);
  };
  const endReplay = () => { setReplay(undefined); setForging(undefined); openMap(mapFocus); };
  const reset = () => { save.reset(); clearTimers(); setLevelId(1); setWin(undefined); setConfirmReset(false); go('home'); };
  const ready = (fontsLoaded || !!fontError) && save.loaded;
  const dusk = screen === 'fail' && level.chapter === 2 ? 1 : screen === 'game' && level.chapter === 2 && level.maxMoves ? (moves / level.maxMoves) * .8 : 0;

  const content = <>
    {screen === 'splash' && <Splash ready={ready} onDone={() => go(seen.prologue ? 'home' : 'prologue')} />}
    {screen === 'prologue' && <Prologue onDone={replay ? endReplay : () => { save.markSeen('prologue'); if (next === 1) start(1); else go('home'); }} />}
    {screen === 'home' && <Home total={total} next={next} chapter={homeChapter} hearts={hearts}
      onPlay={() => (next > levels.length ? openMap(levels.length) : start(next))} onMap={() => openMap()} onSettings={() => setModal('settings')} />}
    {screen === 'map' && <JourneyMap progress={progress} focus={mapFocus} scroll={mapScroll} seen={seen} hearts={hearts} onChapter={setMapChapter}
      onPlay={id => start(id)} onBack={() => go('home')} onWatch={watch} />}
    {screen === 'intro' && <ChapterIntro key={replay?.chapter ?? level.chapter} chapter={replay?.chapter ?? level.chapter}
      onDone={replay ? endReplay : () => { save.markSeen('intros', level.chapter); go('game'); }} />}
    {screen === 'game' && <Gameplay key={`${levelId}:${attempt}`} level={level} moves={moves} lit={trace.activated.length} litIds={trace.activated} won={won}
      cursed={trace.hazardsLit.length > 0} view={view} onView={() => setView(v => (v === 'tilt' ? 'top' : 'tilt'))}
      celebrate={celebrate} canUndo={history.length > 0} onPause={() => setModal('pause')} onRestart={() => { audio.play('whoosh'); begin(levelId); }}
      onUndo={undo} onHint={showHint} onRotate={rotate} />}
    {screen === 'complete' && win && <Complete level={level} {...win} best={progress[levelId]?.moves ?? win.moves} onNext={continueAfterWin}
      onReplay={() => { begin(levelId); go('game'); }} onHome={() => go('home')} onMap={() => openMap(levelId)} />}
    {screen === 'fail' && <Fail level={level} onRetry={() => { begin(levelId); go('game'); }} onMap={() => openMap(levelId)} />}
    {screen === 'outro' && <Outro chapter={replay?.chapter ?? level.chapter} hearts={hearts} onDone={replay ? endReplay : afterOutro} />}
    {screen === 'forge' && forging !== undefined && <Forge chapter={forging} total={replay ? hearts.indexOf(forging) + 1 : hearts.length} onDone={replay ? endReplay : afterForge} />}
    {screen === 'ending' && <Ending onDone={replay ? endReplay : () => { save.markSeen('ending'); go('home'); }} />}
  </>;

  return <ChapterUI.Provider value={worldChapter}>
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <World chapter={screen === 'prologue' ? 0 : worldChapter} mode={worldMode[screen]} level={boardLevel} state={boardState} trace={trace}
        boardKey={playing ? `${levelId}:${attempt}` : `teaser:${boardLevel.id}`} hint={hint} onTap={rotate}
        onBlocked={() => { audio.play('bonk'); audio.haptic('error'); }} insets={insets} dusk={dusk}
        hearts={hearts} forging={screen === 'forge' ? forging : undefined} mapScroll={mapScroll} view={view} />
      {!save.loaded && save.error ? <SafeAreaView style={s.center}><Panel style={{ maxWidth: 420, width: '100%' }}>
        <GameText size={22} font="cinemaBold" strokeWidth={0} style={{ color: '#fff' }}>Your journey got tangled.</GameText>
        <GameText size={15} font="semi" strokeWidth={0} containerStyle={{ marginVertical: 14 }} style={{ color: '#eef2fb' }}>{save.error}</GameText>
        <ToyButton title="TRY AGAIN" label="Retry loading" height={50} onPress={() => void save.load()} />
        <ToyButton title={confirmReset ? 'YES, START FRESH' : 'START NEW JOURNEY'} label={confirmReset ? 'Confirm erase saved data' : 'Start a new journey'}
          tint="red" height={44} fontSize={15} style={{ marginTop: 12 }} onPress={() => (confirmReset ? reset() : setConfirmReset(true))} />
      </Panel></SafeAreaView> : (fontsLoaded || fontError) && (cinematic.includes(screen)
        ? <SafeAreaView style={s.fill} pointerEvents="box-none">{content}</SafeAreaView>
        : <View style={s.fill} pointerEvents="box-none">{content}</View>)}
      {(notice || (save.error && save.loaded)) && <View style={[s.notice, { bottom: safe.bottom + 10 }]}><Panel style={{ width: '100%' }}>
        <GameText size={14} font="semi" strokeWidth={0} style={{ color: '#fff' }}>{save.error ?? notice}</GameText>
        <ToyButton title={save.error ? 'RETRY SAVE' : 'OK'} height={40} fontSize={15} style={{ marginTop: 8 }}
          onPress={() => (save.error ? save.retrySave() : setNotice(undefined))} />
      </Panel></View>}
      <Curtain visible={curtain} duration={280} />
      {modal === 'settings' && <SettingsModal chapter={worldChapter} settings={save.data.settings} onChange={save.setting} onClose={() => setModal(undefined)}
        onReset={reset} onStory={() => go('prologue')} />}
      {modal === 'pause' && <PauseModal chapter={worldChapter} settings={save.data.settings} onChange={save.setting} onResume={() => setModal(undefined)}
        onRestart={() => { begin(levelId); go('game'); }} onHome={() => go('home')} onMap={() => openMap(levelId)} />}
    </View>
  </ChapterUI.Provider>;
}

export default function App() { return <SafeAreaProvider><GameApp /></SafeAreaProvider>; }

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05030f', overflow: 'hidden' },
  fill: { ...StyleSheet.absoluteFillObject },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  notice: { position: 'absolute', left: 14, right: 14 },
});
