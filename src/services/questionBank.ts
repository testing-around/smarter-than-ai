import { QUESTIONS } from '../data/bank';
import { difficultyBand } from '../data/questionAccess';
import type { DifficultyBand, GameDifficulty, Question } from '../types';
import { shuffle } from '../utils/shuffle';

const RANK: Record<DifficultyBand, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
};

function bandRank(question: Question): number {
  return RANK[difficultyBand(question.difficulty)];
}

export function questionBankSize(): number {
  return QUESTIONS.length;
}

export function questionById(id: string): Question | undefined {
  return QUESTIONS.find((question) => question.question_id === id);
}

export function pickDeck(count: number, difficulty: GameDifficulty): Question[] {
  if (count > QUESTIONS.length) {
    throw new Error(`Need ${count} questions but bank only has ${QUESTIONS.length}`);
  }

  if (difficulty === 'adaptive') {
    return shuffle(QUESTIONS).slice(0, count);
  }

  const target: DifficultyBand = difficulty === 'easy' ? 'easy' : 'hard';
  const preferred = shuffle(QUESTIONS.filter((q) => difficultyBand(q.difficulty) === target));
  const neighbors = shuffle(
    QUESTIONS.filter((q) => difficultyBand(q.difficulty) === 'medium' && !preferred.includes(q)),
  );
  const rest = shuffle(
    QUESTIONS.filter((q) => !preferred.includes(q) && !neighbors.includes(q)),
  );

  return shuffle([...preferred, ...neighbors, ...rest].slice(0, count));
}

export function nextAdaptiveDifficulty(
  recentCorrect: boolean[],
  current: DifficultyBand,
): DifficultyBand {
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
  difficulty: DifficultyBand,
): { next: Question; rest: Question[] } {
  const targetRank = RANK[difficulty];
  const exact = remaining.find((q) => difficultyBand(q.difficulty) === difficulty);
  const chosen =
    exact ??
    remaining.find((q) => Math.abs(bandRank(q) - targetRank) === 1) ??
    remaining[0];

  if (!chosen) {
    throw new Error('Question deck is empty');
  }

  return {
    next: chosen,
    rest: remaining.filter((q) => q.question_id !== chosen.question_id),
  };
}

// Hooks for later (not shipped): steal_allowed, sudden-death, picture/sound, parent-authored items.
export const FUTURE_ENGINE_NOTES = {
  steal: 'Question.steal_allowed is stored; scoring does not use it yet.',
  adaptive: 'Grade + numeric difficulty can drive a real adaptive engine later.',
};
