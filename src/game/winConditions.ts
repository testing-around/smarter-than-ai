import type { Player, WinCondition } from '../types';
import { detectLeaders, type TieDetection } from './tieDetection';

export interface MatchEndInput {
  players: Player[];
  winCondition: WinCondition;
  pointTarget: number;
  questionsPlayed: number;
  questionLimit: number;
  remainingCount: number;
  inTiebreak: boolean;
}

export type MatchEndDecision =
  | { kind: 'continue' }
  | { kind: 'winner'; winner: Player; detection: TieDetection }
  | { kind: 'tiebreak'; detection: TieDetection };

export function evaluateMatchEnd(input: MatchEndInput): MatchEndDecision {
  const detection = detectLeaders(input.players);
  const unique = detection.leaders.length === 1 ? detection.leaders[0] : null;

  if (input.inTiebreak) {
    if (unique) {
      return { kind: 'winner', winner: unique, detection };
    }
    if (detection.isTie) {
      return { kind: 'tiebreak', detection };
    }
    return { kind: 'continue' };
  }

  if (input.winCondition === 'POINT_TARGET' && detection.score >= input.pointTarget) {
    if (unique) {
      return { kind: 'winner', winner: unique, detection };
    }
    return { kind: 'tiebreak', detection };
  }

  const limitReached =
    input.questionsPlayed >= input.questionLimit || input.remainingCount === 0;

  if (input.winCondition === 'TIMER' && !limitReached) {
    return { kind: 'continue' };
  }

  if (input.winCondition === 'QUESTION_LIMIT' || limitReached) {
    if (!limitReached) {
      return { kind: 'continue' };
    }
    if (unique) {
      return { kind: 'winner', winner: unique, detection };
    }
    if (detection.isTie) {
      return { kind: 'tiebreak', detection };
    }
  }

  return { kind: 'continue' };
}

export function defaultPointTarget(): number {
  return 500;
}
