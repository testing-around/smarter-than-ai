# Voice enrollment

Voice training is a **real mic path**, not a toggle. Profiles stay on the device (AsyncStorage + optional local wav URIs). Nothing is uploaded.

## Phrases (5, need 3)

1. `My name is {Name} and I'm ready to play`
2. `Yes`
3. `No`
4. `I know the answer`
5. `{Name}`

Progress shows phrase `1/N`. Failures require retry. `voiceReady` is true only after at least three phrases pass a transcript match. Permission errors do **not** mark the player ready.

## What we store

`playerId`, `name`, `enrollmentSamples` (transcript, durationMs, optional `audioUri`, matchScore), `enrolledAt`, quality flags. Audio uses `expo-speech-recognition` `recordingOptions.persist` (already in the standalone APK).

## Matching later

On-device speaker ID is **best-effort**, not a biometric embedding:

- Name in the transcript + enrolled profile → confidence usually ≥ 70% → auto-credit
- Name without a trained profile → ~62% → **Who said that?** / Host + Clicker
- Timing-only guess is capped below 70% so it never auto-scores

Host TTS still must finish before listening (see the host state machine). Skip remains available for tap-only nights.

## Test on a phone

Setup → Voice check → **Train voice** → speak each prompt → player shows **voice ready** only after samples are captured → Enter lobby.
