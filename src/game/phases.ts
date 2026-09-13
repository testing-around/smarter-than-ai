import type { AnswerSource, PhaseBannerId, RoundPhase, TtsOutcome } from '../types';

export const ANSWER_PHASES: readonly RoundPhase[] = [
  'LISTENING_FOR_PLAYERS',
  'WAITING_FOR_ANSWERS',
  'ANSWER_DETECTED',
];

export function isWaitingForAnswers(phase: RoundPhase): boolean {
  return phase === 'LISTENING_FOR_PLAYERS' || phase === 'WAITING_FOR_ANSWERS';
}

export function isHostReadingPhase(phase: RoundPhase): boolean {
  return phase === 'HOST_SPEAKING' || phase === 'REPEATING_QUESTION';
}

export function canAcceptAnswers(phase: RoundPhase, earlyInterrupt = false): boolean {
  if (isWaitingForAnswers(phase)) {
    return true;
  }
  return earlyInterrupt && isHostReadingPhase(phase);
}

export function canStartListening(
  phase: RoundPhase,
  hostSpeaking: boolean,
  listeningEnabled: boolean,
  earlyShoutOut = false,
  repeating = false,
): boolean {
  if (!listeningEnabled) {
    return false;
  }
  if (repeating) {
    return !hostSpeaking && isWaitingForAnswers(phase);
  }
  if (earlyShoutOut && phase === 'HOST_SPEAKING') {
    return true;
  }
  return !hostSpeaking && isWaitingForAnswers(phase);
}

export function isHostSpeakingPhase(phase: RoundPhase): boolean {
  return (
    phase === 'HOST_SPEAKING' ||
    phase === 'REPEATING_QUESTION' ||
    phase === 'HOST_FEEDBACK'
  );
}

export function shouldAdvanceAfterJudgment(
  correct: boolean,
  source: AnswerSource = 'voice',
): boolean {
  if (source === 'skip' || source === 'host') {
    return true;
  }
  return correct;
}

export function bannerFor(
  phase: RoundPhase,
  lastCorrect: boolean | null = null,
  flags: { earlyShoutOut?: boolean; earlyTapIn?: boolean; interrupt?: boolean } = {},
): PhaseBannerId {
  if (
    flags.interrupt &&
    (phase === 'ANSWER_DETECTED' ||
      phase === 'SPEAKER_IDENTIFICATION' ||
      phase === 'ANSWER_TRANSCRIPTION')
  ) {
    return 'interrupt';
  }
  switch (phase) {
    case 'QUESTION_SELECTED':
    case 'QUESTION_DISPLAYED':
      return 'asking';
    case 'REPEATING_QUESTION':
    case 'HOST_SPEAKING':
      return flags.earlyShoutOut || flags.earlyTapIn ? 'asking-armed' : 'asking';
    case 'HOST_SPEECH_FINISHED':
    case 'LISTENING_FOR_PLAYERS':
    case 'WAITING_FOR_ANSWERS':
      return 'listening';
    case 'WRONG_ATTEMPT':
      return 'wrong';
    case 'QUESTION_COMPLETE':
      return lastCorrect === false ? 'wrong' : 'correct';
    case 'ANSWER_DETECTED':
    case 'SPEAKER_IDENTIFICATION':
    case 'ANSWER_TRANSCRIPTION':
    case 'ANSWER_JUDGING':
    case 'SCORE_UPDATE':
      return 'checking';
    case 'HOST_FEEDBACK':
    case 'HOST_FEEDBACK_TTS_COMPLETE':
      if (lastCorrect === true) {
        return 'correct';
      }
      if (lastCorrect === false) {
        return 'wrong';
      }
      return 'checking';
    case 'PAUSED':
      return 'paused';
    case 'TTS_ERROR':
    case 'HOST_STOPPED':
      return 'error';
    default:
      return 'asking';
  }
}

export function bannerLabel(banner: PhaseBannerId): string {
  switch (banner) {
    case 'asking':
      return '🔊 AI IS ASKING…';
    case 'asking-armed':
      return '🔊 HOST READING…';
    case 'interrupt':
      return '⚡ ANSWER HEARD!';
    case 'listening':
      return '🎤 LISTENING…';
    case 'checking':
      return '🧠 CHECKING…';
    case 'correct':
      return '✅ CORRECT';
    case 'wrong':
      return '❌ WRONG';
    case 'paused':
      return '⏸ PAUSED';
    case 'error':
      return '⚠ HOST VOICE';
    default:
      return '🔊 AI IS ASKING…';
  }
}

export function bannerHint(banner: PhaseBannerId): string | null {
  if (banner === 'asking-armed') {
    return 'Tap an answer anytime';
  }
  return null;
}

/** Default path: listening starts only after a real TTS completion — never onStopped/onError. */
export function listeningUnlocksOnTts(outcome: TtsOutcome): boolean {
  return outcome === 'done';
}
