import { correctChoiceIndex } from '../data/questionAccess';
import type {
  AnswerSource,
  Player,
  Question,
  QuestionAttempt,
} from '../types';

export const LISTEN_BUFFER_MS = 400;
export const WRONG_OVERLAY_MS = 2200;

export type AttemptAction = 'reject_unattributed' | 'stay_live' | 'complete';
export type AttemptReason =
  | 'wrong'
  | 'timeout'
  | 'correct'
  | 'skip'
  | 'reveal'
  | 'missing_player';

export function nextAttemptNumber(
  attempts: QuestionAttempt[],
  questionId: string,
): number {
  return attempts.filter((attempt) => attempt.questionId === questionId).length + 1;
}

export function createAttempt(input: {
  question: Question;
  player: Player;
  choiceIndex: number | null;
  isCorrect: boolean;
  responseTimeMs: number;
  inputSource: AnswerSource;
  speakerConfidence?: number | null;
  priorAttempts: QuestionAttempt[];
  timestamp?: number;
}): QuestionAttempt {
  if (!input.player.id || !input.player.name.trim()) {
    throw new Error('Attempts require an identified player');
  }
  const label =
    input.choiceIndex !== null
      ? (input.question.choices[input.choiceIndex] ?? '')
      : '';
  return {
    questionId: input.question.question_id,
    playerId: input.player.id,
    playerName: input.player.name,
    answer: label,
    answerChoice: input.choiceIndex,
    isCorrect: input.isCorrect,
    timestamp: input.timestamp ?? Date.now(),
    responseTimeMs: input.responseTimeMs,
    inputSource: input.inputSource,
    speakerConfidence: input.speakerConfidence ?? null,
    attemptNumber: nextAttemptNumber(input.priorAttempts, input.question.question_id),
  };
}

export function isPlayerLockedOut(
  lockoutPlayerIds: string[],
  playerId: string,
  lockoutEnabled: boolean,
): boolean {
  return lockoutEnabled && lockoutPlayerIds.includes(playerId);
}

export function lockoutsAfterWrong(
  lockoutPlayerIds: string[],
  playerId: string,
  lockoutEnabled: boolean,
): string[] {
  if (!lockoutEnabled || !playerId || lockoutPlayerIds.includes(playerId)) {
    return lockoutPlayerIds;
  }
  return [...lockoutPlayerIds, playerId];
}

export function resetLockouts(): string[] {
  return [];
}

export function questionHasWinner(attempts: QuestionAttempt[]): boolean {
  return attempts.some((attempt) => attempt.isCorrect);
}

export function shouldRevealCorrectAnswer(complete: boolean): boolean {
  return complete;
}

export function decideAttemptOutcome(input: {
  player: Player | null;
  source: AnswerSource;
  timedOut: boolean;
  correct: boolean;
}): { action: AttemptAction; reason: AttemptReason } {
  if (input.source === 'skip') {
    return { action: 'complete', reason: 'skip' };
  }
  if (input.source === 'host') {
    return { action: 'complete', reason: 'reveal' };
  }
  if (!input.player) {
    if (input.timedOut || input.source === 'timeout') {
      return { action: 'stay_live', reason: 'timeout' };
    }
    return { action: 'reject_unattributed', reason: 'missing_player' };
  }
  if (input.correct) {
    return { action: 'complete', reason: 'correct' };
  }
  return { action: 'stay_live', reason: 'wrong' };
}

export function hostWrongLine(name: string): string {
  return `Not this time, ${name}.`;
}

export function hostLineRevealsAnswer(line: string, question: Question): boolean {
  const hay = line.toLowerCase();
  const secret = question.correct_answer.trim().toLowerCase();
  if (!secret) {
    return false;
  }
  return hay.includes(secret) || hay.includes(`the answer is ${secret}`);
}

export function choiceLabel(question: Question, choiceIndex: number | null): string {
  if (choiceIndex === null) {
    return '';
  }
  return question.choices[choiceIndex] ?? '';
}

export function correctLabel(question: Question): string {
  return (
    question.correct_answer ||
    question.choices[correctChoiceIndex(question)] ||
    ''
  );
}
