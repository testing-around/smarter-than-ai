# Attempts + save/resume

One engine. One session. One save system.

## Live until correct

A question stays live until someone is **correct** or the host **skips / reveals**.

Wrong answers are attempts only:

- Record `questionAttempts[]` with player, choice, source, timing, confidence, attempt number
- Overlay `❌ NAME / choice — WRONG` (question remains live)
- Host: `Not this time, {Name}.` — never speaks the correct answer
- Mic off → re-read question + all choices → 400ms buffer → listen again
- Optional lockout (default on): that player cannot try again on **this** question

Full Round Result + Next Question only after `QUESTION_COMPLETE`.

## Save

`GameSession` (`saveVersion: 1`) is written atomically (`tmp` → replace) to AsyncStorage.

Autosave: match start, each attempt, score change, next question, pause, background/close, manual Save.

Resume restores the same `questionId`, attempts, lockouts, scores, and `questionOrder` (no reshuffle). Timer restarts from `remainingTimeMs` after a 3-2-1 countdown and a host re-read.
