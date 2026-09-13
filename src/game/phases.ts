import type { PhaseBannerId, RoundPhase, TtsOutcome } from '../types';

export const ANSWER_PHASES: readonly RoundPhase[] = [
  'LISTENING_FOR_PLAYERS',
  'ANSWER_DETECTED',
];

export function canAcceptAnswers(phase: RoundPhase): boolean {
  return phase === 'LISTENING_FOR_PLAYERS';
}

export function canStartListening(
  phase: RoundPhase,
  hostSpeaking: boolean,
  listeningEnabled: boolean,
): boolean {
  return listeningEnabled && !hostSpeaking && phase === 'LISTENING_FOR_PLAYERS';
}

export function isHostSpeakingPhase(phase: RoundPhase): boolean {
  return phase === 'HOST_SPEAKING' || phase === 'HOST_FEEDBACK';
}

export function bannerFor(
  phase: RoundPhase,
  lastCorrect: boolean | null = null,
): PhaseBannerId {
  switch (phase) {
    case 'QUESTION_SELECTED':
    case 'QUESTION_DISPLAYED':
    case 'HOST_SPEAKING':
      return 'asking';
    case 'HOST_SPEECH_FINISHED':
    case 'LISTENING_FOR_PLAYERS':
      return 'listening';
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

/** Listening starts only after a real TTS completion — never onStopped/onError. */
export function listeningUnlocksOnTts(outcome: TtsOutcome): boolean {
  return outcome === 'done';
}
