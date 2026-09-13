import { QUESTIONS } from '../data/questions';
import type { GameDifficulty, Question, QuestionDifficulty } from '../types';
import { shuffle } from '../utils/shuffle';

const RANK: Record<QuestionDifficulty, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
};

export function questionBankSize(): number {
  return QUESTIONS.length;
}

export function pickDeck(
  count: number,
  difficulty: GameDifficulty,
): Question[] {
  if (count > QUESTIONS.length) {
    throw new Error(`Need ${count} questions but bank only has ${QUESTIONS.length}`);
  }

  if (difficulty === 'adaptive') {
    return shuffle(QUESTIONS).slice(0, count);
  }

  const target: QuestionDifficulty = difficulty === 'easy' ? 'easy' : 'hard';
  const preferred = shuffle(QUESTIONS.filter((q) => q.difficulty === target));
  const neighbors = shuffle(
    QUESTIONS.filter((q) => q.difficulty === 'medium' && !preferred.includes(q)),
  );
  const rest = shuffle(
    QUESTIONS.filter((q) => !preferred.includes(q) && !neighbors.includes(q)),
  );

  const deck = [...preferred, ...neighbors, ...rest].slice(0, count);
  return shuffle(deck);
}

export function nextAdaptiveDifficulty(
  recentCorrect: boolean[],
  current: QuestionDifficulty,
): QuestionDifficulty {
  const lastTwo = recentCorrect.slice(-2);
  if (lastTwo.length === 2 && lastTwo.every(Boolean) && current !== 'hard') {
    return current === 'easy' ? 'medium' : 'hard';
  }
  if (lastTwo.length === 2 && lastTwo.every((v) => !v) && current !== 'easy') {
    return current === 'hard' ? 'medium' : 'easy';
  }
  return current;
}

export function takeMatching(
  remaining: Question[],
  difficulty: QuestionDifficulty,
): { next: Question; rest: Question[] } {
  const exact = remaining.find((q) => q.difficulty === difficulty);
  const chosen =
    exact ??
    remaining.find((q) => Math.abs(RANK[q.difficulty] - RANK[difficulty]) === 1) ??
    remaining[0];

  if (!chosen) {
    throw new Error('Question deck is empty');
  }

  return {
    next: chosen,
    rest: remaining.filter((q) => q.id !== chosen.id),
  };
}

