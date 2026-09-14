# Smarter Then AI

**Are you Smarter Then AI?** — a family party trivia game for iOS, Android, and web. THEN is intentional branding (not THAN).

Players enter names, get random multiple-choice questions from a built-in bank, race a countdown timer, and (on a real device) shout answers. The host credits the speaker when it can, and never throws an answer away when it cannot.

- App name: **Smarter Then AI**
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

1. **Home** — **New game**, **Continue game** (unfinished save), **Past games**, or jump into Family Battle, Lightning, Beat the AI, or Grade Challenge.
2. **Setup** — names + emoji (defaults: Damian 🧠, Dorian 🦖, Delissa ⚡), question count 5/10/20, shout out / buzz-in / turn based, easy / adaptive / hard, timer 8–20s, **host mode** (default **Host + Clicker**), optional **⚡ EARLY SHOUT-OUT**.
3. **Voice check** — **Train / Retrain / Test / Delete** walks each human through 5 spoken lines (need 3). Profiles persist on-device for offline speaker ID. Skip remains tap-only. See `docs/VOICE-ENROLLMENT.md` and `docs/VOICE-AUDIT.md`.
4. **Lobby** — roster + rules, then start.
5. **Game** — host reads the full question (🔊 HOST READING…). In shout-out, **tap an answer anytime** (default on), even during the read and re-reads. The mic still waits for TTS `onDone` unless **Early shout-out** is on. Wrong answers stay on the **same question** (overlay only — no reveal, no Next). Last question is a **boss round (3×)**.
6. **Round result** — full result only after a **correct** answer (or host skip/reveal). Then Next Question.
7. **Final** — leaderboard and rematch.

Scoring: a correct answer earns `(100 + speedBonus) × multiplier`. Speed bonus is ~50 under 2s, ~30 under 4s, otherwise ~15. Wrong or timeout is 0.

Default answer path is tap. In shout-out with more than one human, a tap (or a nameless shout) opens **Who said that?** so someone claims the points.

## Voice approach (MVP)

This build uses the best Expo SDK 57-compatible stack that still degrades to a fun tap game:

| Layer | What we use | Notes |
| --- | --- | --- |
| Speech-to-text (JOB1) | [`expo-speech-recognition` ^57](https://github.com/jamsch/expo-speech-recognition) | Transcript only. Prefers on-device English when the pack is installed. |
| Speaker ID (JOB2) | Local `sta-bands-v1` embeddings on this device | Not learned by the STT engine. Calibrated score + margin; uncertain → Who said that? |
| Low confidence | Never discard | Host asks **Who said that?** and assigns to the claimer |
| Host voice | [`expo-speech`](https://docs.expo.dev/versions/v57.0.0/sdk/speech/) + `pickBritishFemaleHostVoice()` | Default **British female** (`en-GB`). Setup can switch to system default. |
| Persistence | `@react-native-async-storage/async-storage` | Last players, settings, family leaderboard |

**Device support**

- **Development build / `npx expo run:ios` / `run:android`**: full mic + STT + TTS.
- **Classic Expo Go**: native `expo-speech-recognition` is not in the Go binary. The app detects that and stays playable tap-only.
- **Web (Chrome / Edge)**: Web Speech API can listen. Firefox / some Linux environments have no recognizer — tap still works.
- Permissions: microphone + speech recognition on iOS; `RECORD_AUDIO` on Android.

Enrollment is a **real training path** (mic permission, 5 spoken lines, min 3 valid). Embeddings persist in AsyncStorage across restart and airplane mode. Raw wav is not kept. Live rounds still parse names/A–D, then compare a local embedding. Calibrated confidence under 70% or a thin margin opens **Who said that?** or Host + Clicker. Turn-based rounds assign a nameless answer to the current player. Buzz-in assigns a nameless answer to whoever buzzed. Profiles stay on-device; nothing is uploaded.

### Host / listen / judge (strict)

The host never accepts, scores, or reveals an answer until TTS **finishes** (`expo-speech` `onDone`). Sequence:

`QUESTION_SELECTED → DISPLAYED → HOST_SPEAKING → HOST_SPEECH_FINISHED → LISTENING_FOR_PLAYERS → … → HOST_FEEDBACK → next`

- Mic is **off** while 🔊 AI IS ASKING… so host audio does not enter contestant STT. **Early shout-out** is the explicit exception: the contestant mic may open during `HOST_SPEAKING`.
- Timer starts at 🎤 LISTENING…, not at question display (early interrupts still keep the question on screen).
- Host question text is display + TTS only. The correct answer stays internal until someone answers or time expires. Host TTS is never scored as a contestant answer (echo rejection).
- Stale callbacks from a previous `questionSessionId` are ignored.

**Early shout-out** (opt-in; default remains P2 / wait for TTS):

`🔊 HOST READING…` (Tap an answer anytime) `→ ⚡ ANSWER HEARD! → WHO? → ✅/❌`

- Humans can shout (or tap) while the host is reading. Host TTS pauses. Host + Clicker picks **who said it**, or a high-confidence speaker guess auto-assigns.
- **Correct** → score, host feedback, next question.
- **Incorrect** → do not advance; same question stays live and listening continues until someone is right (or skip/timeout).
- Works with **Beat the AI** and **human-only** Family Battle. The AI contestant never answers from host narration — only after the listen window / its existing delay.
- Setup toggle **⚡ EARLY SHOUT-OUT**, or Family / Lightning / Beat the AI quick modes. Grade Challenge stays P2.

**Host modes** (Setup):

| Mode | What happens |
| --- | --- |
| **Host + Clicker** (default) | AI reads and listens, then you get **WHO ANSWERED?** `[players] [AI GOT IT] [UNKNOWN]` and optional **CORRECT?** override. Best for testing. |
| **Full AI host** | Auto-judge when speaker+answer are clear; **Who said Mars?** if speaker unknown; auto-advance after feedback TTS. |
| **Human + AI assist** | You own next / who / correct / skip / pause. AI still displays, reads, listens, and suggests. |

On-game controls: Pause / Resume / Repeat (re-read, wait for TTS, then listen again) / Skip / Stop host speaking. If TTS fails: Retry or **I read it — listen**.

Exercise Clicker: Setup → **HOST + CLICKER** → start a match → wait for 🎤 LISTENING… → tap an answer or shout one → pick a player and Confirm (optionally override CORRECT?).

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

This build keeps JOB1 as STT and adds a local JOB2 matcher (`sta-bands-v1` embeddings). A shipping product would still swap that stub for ONNX/ECAPA. **Who said that?** still stands in when confidence or margin is low.

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

The playable bank is **431 unique items** after merge (`src/data/bank.ts`: seed + Grade 1–10 starters + converted legacy + gap fillers, deduped, `active` and `quality_score >= 0.7`). Schema: `docs/QUESTION-SCHEMA.md`. Categories: `docs/CATEGORIES.md`. A round shuffles and does not repeat IDs. Last question (and `question_type: BOSS`) is 3×.

## Android APK

Sideload notes and rebuild commands: `docs/ANDROID-APK.md`. Latest preview: [SmarterThenAI-1.1.0-preview.apk](https://github.com/testing-around/smarter-than-ai/releases/download/v1.1.0-preview/SmarterThenAI-1.1.0-preview.apk) (versionName **1.1.0**, versionCode **8**, SHA-256 `f18eaebd5ac1df92b519cc4eb4b938950093a47d8655ea0775a6b665306550a3`). Preview profile in `eas.json` outputs an **APK** (`buildType: apk`). This environment has no Expo login, so the preview APK is produced locally with `expo prebuild` + Gradle.

## Config

`app.json`

- `name`: Smarter Then AI
- `slug`: smarter-than-ai
- `userInterfaceStyle`: dark
- iOS `bundleIdentifier` / Android `package`: `com.smarterthanai.game` (kept; not renamed)

## Later (stubs)

Full 1750+ generated bank, deeper adaptive difficulty, a full sound-design pack, accessibility suite, continuous voice-learning ML, and elimination mode are deferred. TIMER as a match-end clock is stubbed (still ends on the question cap + tiebreak).
