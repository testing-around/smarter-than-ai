# Early shout-out

Opt-in interrupt so humans can answer **while the host is still reading**. Default play (P2) still keeps the mic off until TTS `onDone`.

## Arming

`earlyShoutOut && answerMode === 'shout'`

- Default settings: **off**
- Family Battle, Lightning, Beat the AI: **on**
- Grade Challenge: **off**
- Setup toggle: **⚡ EARLY SHOUT-OUT** (forces shout-out mode)

Voice listen still requires `voiceEnabled` at the listening gate. Host TTS echo is never scored.

## Flow

1. `HOST_SPEAKING` + armed → banner `🔊 HOST READING…` with “Tap an answer anytime” and contestant mic may open.
2. Contestant speech that passes `isContestantInterrupt` (not host echo, not two+ choices at once, short isolated answer or name+answer) stops host TTS.
3. Banner `⚡ ANSWER HEARD!` plus the Host + Clicker / Who-said-that panel (or auto-assign at ≥70% speaker confidence).
4. **Correct** → score, feedback, next question.
5. **Incorrect** → `WRONG_STAY`: same `questionSessionId`, unlock, `LISTENING_FOR_PLAYERS`, keep listening. No forced full re-read.

Timeout and skip still advance.

## Early tap (separate from the mic)

Shout-out mode also allows **tapping a choice while the host is reading**, including re-reads after a wrong attempt.

- Setting: `earlyTapIn` (default **on**; Setup: **👆 TAP WHILE HOST READS**)
- Armed when `answerMode === 'shout'` and `earlyTapIn !== false`
- First valid tap stops host TTS, then uses the same multi-attempt / Who-said-that / Host+Clicker path
- Does **not** open the mic. Voice early shout stays on `earlyShoutOut`
- Grade / turn / buzz-in still wait for the host unless those modes change

## AI contestant

`scheduleAi` runs only after the listen window (`unlockListening`) or after a wrong-stay resume. It refuses `HOST_SPEAKING`. Host narration never enters the AI answer pipeline.
