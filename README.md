# Smarter Than AI

**Are You Smarter Than A AI?** — a family party trivia game for iOS, Android, and web.

Players enter names, get random multiple-choice questions from a built-in bank, race a countdown timer, and (on a real device) shout answers. The host credits the speaker when it can, and never throws an answer away when it cannot.

- App name: **Smarter Than AI**
- Package / bundle: `com.smarterthanai.game`
- Stack: Expo SDK 57, React Native 0.86, TypeScript

## Run it

```bash
npm install
npx expo start
```

Then press `i` (simulator), `a` (Android), `w` (web), or scan the QR code.

```bash
npx expo start --web
npx expo start --ios
npx expo start --android
```

Typecheck:

```bash
npx tsc --noEmit
```

## How a night plays

`HOME → SETUP → VOICE_CHECK → LOBBY → GAME → ROUND_RESULT → FINAL` (rematch).

1. **Home** — start a custom game or jump into Family Battle, Lightning, Beat the AI, or Grade Challenge.
2. **Setup** — names + emoji (defaults: Damian 🧠, Dorian 🦖, Delissa ⚡), question count 5/10/20, shout out / buzz-in / turn based, easy / adaptive / hard, timer 8–20s.
3. **Voice check** — each human enrolls by saying `I'm {name} and I'm smarter than AI`. If the mic is missing, mark enrolled and play tap-only.
4. **Lobby** — roster + rules, then start.
5. **Game** — live scoreboard, category, four choices, countdown. Last question is a **boss round (3×)**.
6. **Round result** — who answered, correct?, points, response ms, explanation.
7. **Final** — leaderboard and rematch.

Scoring: a correct answer earns `(100 + speedBonus) × multiplier`. Speed bonus is ~50 under 2s, ~30 under 4s, otherwise ~15. Wrong or timeout is 0.

Default answer path is tap. In shout-out with more than one human, a tap (or a nameless shout) opens **Who said that?** so someone claims the points.

## Voice approach (MVP)

This build uses the best Expo SDK 57-compatible stack that still degrades to a fun tap game:

| Layer | What we use | Notes |
| --- | --- | --- |
| Speech-to-text | [`expo-speech-recognition` ^57](https://github.com/jamsch/expo-speech-recognition) | iOS `SFSpeechRecognizer`, Android `SpeechRecognizer`, Web Speech API |
| Attribution | Name-then-answer parser + enrollment | “Damian, B” or “Dorian, Pacific”. Not biometric speaker ID |
| Low confidence | Never discard | Host asks **Who said that?** and assigns to the claimer |
| Host voice | [`expo-speech`](https://docs.expo.dev/versions/v57.0.0/sdk/speech/) + `pickBritishFemaleHostVoice()` | Default **British female** (`en-GB`). Setup can switch to system default. |
| Persistence | `@react-native-async-storage/async-storage` | Last players, settings, family leaderboard |

**Device support**

- **Development build / `npx expo run:ios` / `run:android`**: full mic + STT + TTS.
- **Classic Expo Go**: native `expo-speech-recognition` is not in the Go binary. The app detects that and stays playable tap-only.
- **Web (Chrome / Edge)**: Web Speech API can listen. Firefox / some Linux environments have no recognizer — tap still works.
- Permissions: microphone + speech recognition on iOS; `RECORD_AUDIO` on Android.

Enrollment is a practical party check (“can we hear this person?”), not a voiceprint. Live rounds parse the transcript for player names and A/B/C/D (or choice text). Turn-based rounds assign a nameless answer to the current player. Buzz-in assigns a nameless answer to whoever buzzed.

### British female host (default)

`src/services/hostVoice.ts` picks the best **en-GB female** voice on the device:

- Scores `en-GB` first, then names like Google UK English Female, Microsoft Hazel / Libby / Susan / Sonia, Kate, Serena.
- Fallback: any `en-GB` voice, then speak with `language: 'en-GB'` even if no named voice exists.
- Crisp game-show energy: pitch **1.08**, rate **1.06** (not cartoonish).
- Availability varies: Chrome/Edge often have “Google UK English Female”; iOS may offer Kate/Serena; Android TTS packs differ. Linux / Firefox / Expo Go may only get the language hint. Toggle **Host voice → System default** in Setup if you prefer the OS voice.

## Production pipeline (not this MVP)

A shipping voice product would run:

**VAD → Speaker ID → STT → parser → scoring → TTS**

1. **VAD** — detect that someone started talking (energy / silero-style voice activity).
2. **Speaker ID** — match the clip against enrollment embeddings (not just a name in the transcript).
3. **STT** — cloud or on-device recognition with a biased vocabulary (player names, A–D, choice phrases).
4. **Parser** — map text to a player + choice with confidence.
5. **Scoring** — same formula as this app, plus anti-double-buzz.
6. **TTS** — host announces the winner of the toss-up.

This MVP collapses that to **STT → name/answer parser → scoring → TTS**, with **Who said that?** standing in for Speaker ID when confidence is low.

## Project layout

```
src/
  screens/      HOME, SETUP, VOICE_CHECK, LOBBY, GAME, ROUND_RESULT, FINAL
  components/   orb, buttons, scoreboard, claim modal
  data/         merged master bank + default players
  types/        master question + game schema
  services/     scoring, bank shuffle, STT, British host TTS, parser, AsyncStorage
  context/      screen machine + round timer
  theme/        game-show palette
```

The playable bank is **395 unique items** after merge (`src/data/bank.ts`: 190 seed + converted legacy + gap fillers, deduped, `active` and `quality_score >= 0.7`). Schema: `docs/QUESTION-SCHEMA.md`. Categories: `docs/CATEGORIES.md`. A round shuffles and does not repeat IDs. Last question (and `question_type: BOSS`) is 3×.

## Android APK

Sideload notes and rebuild commands: `docs/ANDROID-APK.md`. Preview profile in `eas.json` outputs an **APK** (`buildType: apk`). This environment has no Expo login, so the preview APK is produced locally with `expo prebuild` + Gradle.

## Config

`app.json`

- `name`: Smarter Than AI
- `slug`: smarter-than-ai
- `userInterfaceStyle`: dark
- iOS `bundleIdentifier` / Android `package`: `com.smarterthanai.game`
