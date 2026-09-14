# Voice enrollment

Voice training is two jobs that share one microphone, not one magic API:

1. **JOB1 STT** — `expo-speech-recognition` transcribes what was said.
2. **JOB2 speaker ID** — a local speaker profile (`sta-bands-v1` embeddings) guesses who said it. The STT engine does **not** learn speakers.

Profiles stay on this device (AsyncStorage). Raw enrollment wav is embedded, then dropped. Nothing is uploaded.

## Phrases (5, need 3)

Each line is meant to be about 2–5 seconds of clean speech:

1. `My name is {Name} and I am ready to play Smarter Then AI`
2. `Yes, I know this one and I am sure of my answer`
3. `No, that is not the answer I wanted to give`
4. `I know the answer and I want to shout it out now`
5. `{Name} is speaking now and this is my trained voice`

`voiceReady` is true only after at least three valid samples (speech detected, length, not silence, phrase match). Prefer all five. Permission errors do **not** mark the player ready.

## What we store

`playerId`, `name`, embeddings / centroid, `embeddingModel`, `samplesAccepted`, quality, `locale`, `offlineReady`, transcript metadata. Audio URIs are not persisted.

## Matching later

- Name in the transcript + enrolled profile → calibrated confidence usually ≥ 70% → auto-credit
- Local embedding match with calibrated score **and** top1−top2 margin → auto-credit
- Ambiguous / low margin / timing-only → **Who said that?** — we never guess
- Host TTS still must finish (`onDone` + 350ms) before listening, including training prompts

## UI

Train / Retrain / Test my voice / Delete voice profile. Badges: **TRAINED**, **NEEDS TRAINING**, **Offline READY**. Long-press the title for diagnostics. Errors offer Try again / Diagnostics / Tap-only — never a bare “Speech recognition aborted.”

## Test on a phone

Setup → Voice check → **Train voice** → wait for the host to finish the prompt → speak the line → player shows **TRAINED** / **Offline READY** after samples are captured → Enter lobby. Restart the app (and optionally enable airplane mode) and confirm the profile is still there.
