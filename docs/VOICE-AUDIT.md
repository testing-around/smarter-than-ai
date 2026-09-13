# Voice audit report (1.0.5)

Status: **ABORT ROOT CAUSE EXPLAINED AND CODE-FIXED. NOT MARKED DEVICE-FIXED.**  
Airplane-mode STT and live multiplayer uncertainty were not run on a physical phone in this environment. Do not treat this as a field sign-off.

## Abort questions (Priority 1)

### 1. What triggered abort?

Our own JavaScript. `src/services/voice.ts` `stopListening()` called `ExpoSpeechRecognitionModule.abort()` on **every** start (to “reset”) and again on every successful enrollment / `listenOnce` result. The library maps `abort()` to an `error` event with code `aborted` and message **“Speech recognition aborted.”** That error was forwarded to Voice Check as a failed capture.

A second trigger: **Retry this phrase** stayed enabled while listening, so a second `startListening()` aborted the first session. Permission was also re-requested on every start, which can remount / interrupt the recognizer.

This was not “Android randomly aborted.” It was a self-abort.

### 2. Did our code call abort()?

**Yes.** Before this change, `stopListening()` was abort-only. Call sites:

- `startListening()` → always `await stopListening()` before `start()`
- `captureEnrollmentSample` `finish()` → `stopListening()` on success, timeout, and error
- `listenOnce` on success / timeout / error
- `playerListeningEngine` when the listen gate closed / unmount

`abort()` now exists only in `cancelListening()` (user Cancel, timeout recovery, close mic). Success uses `stop()`.

### 3. Recognizer state?

There was no real state machine — implicit “maybe listening.” A new session could start while the previous abort callback was still in flight. We now use `IDLE → PREPARING → LISTENING → PROCESSING → SAVING → SUCCESS|ERROR` with a `sessionId` lock. Stale callbacks are ignored.

### 4. TTS active?

Voice Check did not speak the training prompt, but entering the screen calls host TTS (“Train each voice…”). Tapping **I’m ready** during that line (or leftover `warmHostVoice`) could collide. There was no `isHostTtsActive()` gate. We now wait for real `onDone` / `onStopped` + **350ms** before `start()`, including training prompts (host reads the line first).

### 5. Another recognizer active?

Only one native `SpeechRecognizer`. A second `start()` aborts the first. Double-start is now blocked while `PREPARING` / `LISTENING` / `PROCESSING` / `SAVING`.

### 6. Mic permission?

Abort was **not** primarily a permission failure. Permission was requested on every start (`requestPermissionsAsync`), which is noisy and can interrupt. We now `getPermissionsAsync` first and request only if needed. Denial maps to a permission UX, not “aborted.”

### 7. Android recognition service?

Previously unused. We now probe `getDefaultRecognitionService`, `getAssistantService`, `getSpeechRecognitionServices` (via diagnostics), and `getSupportedLocales`. Default is whatever the device reports (often `com.google.android.googlequicksearchbox`). Prefer on-device STT only when `supportsOnDeviceRecognition()` and an installed `en*` locale exist.

### 8. Native error code?

Library: user `abort()` → JS `error: "aborted"` (Android native code often `ERROR_CLIENT` / client, or `-1`). Structured `[VOICE]` dumps now record `errorType`, `nativeErrorCode`, `requestedAbort`, TTS, mic, service, offline pack, session, screen, player, phrase.

### 9. Remount / unmount?

Voice Check had **no** `useEffect` cleanup abort (good). Game unmount called `closePlayerMic()` → old `abort()`. Rerender itself did not abort; **Retry** and **abort-before-start** did. Unmount now `cancelListening()` only if a session is live.

### 10. start() before previous session ended?

**Yes.** Every start aborted the previous session and immediately called `start()`, so the abort error could land on the new listeners. Mutex + sessionId prevent that.

## Remaining report fields

### 11. Root cause (one line)

`stopListening()` === `abort()`, invoked before every `start()` and after every success, which is exactly the native error the user saw.

### 12. Files (primary)

- `src/services/voice.ts` — abort/stop split, mutex, TTS gate, on-device probe, `[VOICE]` dumps
- `src/voice/recognitionSession.ts` — state machine + sessionId
- `src/voice/mapRecognitionError.ts` — never show bare “Speech recognition aborted.”
- `src/voice/speakerEngine.ts` + `audioFeatures.ts` — local embeddings + calibrated confidence
- `src/game/enrollmentMachine.ts` — 5 longer phrases, min 3 valid, persist embeddings, drop raw audio
- `src/screens/VoiceCheckScreen.tsx` — Train / Retrain / Test / Delete, diagnostics, recovery actions
- `src/services/tts.ts` — `isHostTtsActive` / `waitForHostTtsIdle`
- `src/services/playerListeningEngine.ts` — cancel vs start; ignore unsolicited abort
- `src/context/GameContext.tsx` — delete profile; live embedding match
- Tests: `src/voice/*.test.ts`, updated enrollment / speaker tests

### 13. Offline STT (JOB1)

Still `expo-speech-recognition`. We prefer `requiresOnDeviceRecognition` when the device reports on-device support **and** an installed English locale. If the pack is missing, we do **not** force on-device (that would hard-fail). Airplane-mode STT therefore depends on the phone’s offline en-US pack. This was **not** verified on a device in this environment.

### 14. Speaker model (JOB2)

Shipped: **`sta-bands-v1`** — 20-D unit vector (8-band Goertzel mean/std + log-energy + ZCR) from the enrollment/live wav when recording is available. ONNX / ECAPA is a documented stub (`src/voice/onnxSpeakerStub.ts`), not loaded in the APK. Profiles persist embeddings + centroid in AsyncStorage (`@sta/voice-profiles`) across restart. Raw audio is not stored.

If recording/wav parse fails, enrollment can still become `voiceReady` from valid transcripts, but `offlineReady` stays false and we will not auto-assign from timing.

### 15. Thresholds

| Signal | Rule |
| --- | --- |
| Phrase match | ≥ 0.55 to accept a training line |
| Valid sample | 1.2–8.0s, speech detected, ≥4 transcript chars, phrase pass |
| Ready | min 3 valid (prefer 5) |
| Auto-assign | calibrated confidence ≥ 0.70 **and** not ambiguous |
| Embedding auto | calibrated ≥ 0.72 **and** cosine ≥ 0.35 **and** top1−top2 ≥ 0.10 |
| Uncertain | `Who said that?` — never guess |

Calibrated score is a logistic of cosine, **not** raw cosine displayed as a percent.

### 16. Airplane-mode result

**Not device-tested here.** Code path: embeddings live in AsyncStorage (no network). Speaker match does not call the network. JOB1 STT in airplane mode only works if the on-device English pack is installed; otherwise the user gets a mapped network / service error plus Try again / Diagnostics / Tap-only.

Honest remaining risk: some Android images expose `supportsOnDeviceRecognition()` but still fail offline without `com.google.android.as` + en-US.

### 17. TTS / mic test

**Not device-tested here.** Code: `hostSay` sets an active flag until `onDone` / `onStopped` / `onError`; `startListening` awaits idle + 350ms; training speaks the prompt first. Host TTS gate for live play is unchanged (plus early shout-out exception). Wrong-answer stays live.

### 18. Multiplayer uncertainty

Unit-tested: two identical embeddings → `ambiguous` / `Who said that?`; timing-only never auto-assigns; name-without-profile stays below 70%. **Not** tested with two real people on a phone.

### 19. Persistence / restart

Profiles are AsyncStorage, not session state. `loadVoiceProfiles()` on hydrate. Delete / retrain / test are first-class. Hydrate still marks a player `voiceReady` when a stored profile matches the name.

### 20. Remaining issues

- No physical-phone confirmation that abort is gone after the code fix
- No airplane-mode run on hardware
- Band embeddings are a practical local matcher, not ECAPA; expect more “Who said that?” than a commercial speaker-ID SDK
- Live-round embedding needs `supportsRecording()` (typically Android 13+)
- Web / Expo Go remain tap-fallback
- ONNX model is a stub by design in this PR

## Structured logs

Look for `[VOICE]` JSON lines: `start.requested`, `start.blocked_busy`, `start.native`, `event.*`, `stop.requested`, `abort.requested`, `error.dump` (full field list from Priority 1). Long-press **Train each voice** for the in-app diagnostics panel.
