# Mirror Maze — The Last Lightkeeper

A story-driven, portrait-first 3D light puzzle game for Android (and web/iOS), built with Expo SDK 54,
React Native, TypeScript and Three.js (React Three Fiber).

The Great Prism that carried light between five worlds has shattered, and the Void has opened its eye.
As the last Lightkeeper, you bend light through five worlds and gather every crystal shard to forge
five Hearts. Together, the Hearts seal the Void.

## The game

- **5 chapters × 27 levels = 135 hand-verified puzzles**, each with its own title and story line.
- **One scrolling journey map**: every level sits on a small floating isle styled after its world (temples
  above the clouds, a stormy jungle, the desert, glaciers, an asteroid field). Cleared levels are joined
  by glowing beams of light that you follow onward. Moving between chapters crossfades the 3D world
  behind a chapter gate.
- **Cutscenes with narration** for the prologue, every chapter intro, every chapter finale, each Heart
  forging and the ending. Each line is narrated by a female voice, and the captions appear in time with
  her. Every cutscene can be replayed from its chapter gate on the map.
- **Rewards**: up to 3 crystal shards per level. Clearing a chapter's final level opens the next world.
  Earning all 81 shards in a world forges that world's Heart into the Lightkeeper's Amulet. Forging all
  five Hearts plays the ending.
- **Monetisation hook**: an interstitial slot after every third completed level (`src/services/ads.ts`).
  It does nothing until an ad SDK is plugged in.

### Mechanics and how difficulty grows

Every level has a **move limit**. A perfect solve earns 3 shards, par + 2 moves earns 2, anything within
the limit earns 1, and running out of moves fails the level (0 shards).

| World | Light source | New ideas |
| --- | --- | --- |
| 1 Sky Temples | Sun Lens | Turning mirrors, stone blocks, fixed gold mirrors, decoy mirrors, multi-crystal paths, **Twin Suns** (two cannons) |
| 2 Rainforest | Spirit Totem | **Vine-linked mirrors** (turn together), **turnable cannons** (tap the totem) |
| 3 Desert | Eye of Ra | **Prisms** split the beam, **cursed gems** must stay dark, twin suns with prisms |
| 4 Ice Age | Frost Lantern | **Frozen mirrors** thaw only when light touches them, **triple lanterns** |
| 5 The Void (asteroid) | Star Engine | **Wormholes**, then every mechanic combined, up to three cannons, final boss |

The level generator (`scripts/generate-levels.ts`) verifies every level with a breadth-first solver, so
par is always the true optimum. From the middle of the first world onward, levels must also defeat a
simulated "follow the beam" player who only taps the mirror the light is touching. Bosses must also beat
a greedy player who tries every tap, so they can't be won without planning.

### Feel

- A cinematic play camera: a sweeping reveal when the level opens, a gentle drift, a small push on every
  tap and a slow push-in on victory. A **tilt / top-down** toggle helps on the larger boards.
- An animated beam styled for each world (sunbeam, rain spirit, solar fire, aurora frost, void plasma).
  It ends a little past the board edge. When you win, the light charges into each crystal, then bursts.
- Synthesised audio for every effect, plus music and ambience per world (`scripts/generate-audio.mjs`).

## Run

This Windows workspace keeps a portable Node.js in `.tools` (git-ignored). On a fresh machine, install
Node.js 22.14+, then:

```powershell
npm ci
npm run web          # browser preview
npx expo start --lan # Expo Go (SDK 54) on a phone
```

## Build the Android APK

Requires JDK 17 and the Android SDK (platform 35, build-tools 35, NDK 27.1).

```powershell
npx expo prebuild --platform android --clean
cd android
.\gradlew.bat assembleRelease
# -> android/app/build/outputs/apk/release/app-release.apk
```

The release build is signed with the Expo template's debug keystore. It installs directly on any device
(sideload). Before publishing to the Play Store, sign it with your own upload key.

## Regenerating content

```powershell
npx tsx scripts/generate-levels.ts   # 135 levels -> src/game/levels.json
node scripts/generate-audio.mjs      # sound effects, music, ambience -> assets/audio
npx tsx scripts/generate-voice.ts    # narration -> assets/voice + src/services/voiceClips.ts
node scripts/generate-icons.cjs      # app icon and splash -> assets/images (needs `npm i --no-save sharp`)
```

Narration is recorded offline with [Piper](https://github.com/rhasspy/piper) using the
`en_GB-jenny_dioco-medium` voice. Each line is then processed (EQ, compression, soft hall reverb), and the
real clip length is written into `voiceClips.ts`, which keeps the captions in sync with the voice.
Download `piper_windows_amd64.zip` and the voice `.onnx`/`.onnx.json` files into `.tools/piper` to
regenerate.

## Architecture

| Area | Responsibility |
| --- | --- |
| `App.tsx` | Screen flow, moves/undo, win timeline, rewards, story beats, cutscene replays |
| `src/game/engine.ts` | Pure tracing (multi-cannon, prisms, portals, hazards), moves, BFS solver, greedy-player and reachability analysis |
| `src/game/levels.json` + `chapters.ts` | Generated levels, story text, titles, tutorial tips |
| `src/world/` | Three.js world: per-chapter environments, board, pieces, beam shaders, camera director, Amulet |
| `src/screens/` | Splash, prologue, home, journey map, chapter intro, gameplay HUD, results, story cutscenes, popups |
| `src/ui/` | Buttons, panels, SVG title art, map isles, effects |
| `src/services/` | Saves (validated, versioned), audio, narration, haptics, ad slot |

## Tests

```powershell
npm run typecheck
npm test
```

There are 293 tests. Every level is checked to be valid, unsolved at the start, with an optimal par.
Every level is also proven to support all four outcomes within its move limit: 3, 2 and 1 shards, plus a
0-shard fail. Other tests cover the anti-greedy guarantees, mechanics, rewards and Heart rules, and save
migration.
