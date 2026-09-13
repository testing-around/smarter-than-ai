import type { DifficultyBand, MasterCategory, Question } from '../types';

export const PLAYABLE_QUALITY = 0.7;

export function difficultyBand(level: number): DifficultyBand {
  if (level <= 3) {
    return 'easy';
  }
  if (level <= 6) {
    return 'medium';
  }
  return 'hard';
}

export function bandToDifficulty(band: DifficultyBand): number {
  if (band === 'easy') {
    return 2;
  }
  if (band === 'hard') {
    return 8;
  }
  return 5;
}

export function correctChoiceIndex(question: Question): number {
  const target = normalizeAnswer(question.correct_answer);
  const exact = question.choices.findIndex((choice) => normalizeAnswer(choice) === target);
  if (exact >= 0) {
    return exact;
  }
  const accepted = new Set(question.accepted_answers.map(normalizeAnswer));
  const viaAccepted = question.choices.findIndex((choice) => accepted.has(normalizeAnswer(choice)));
  return viaAccepted >= 0 ? viaAccepted : 0;
}

export function normalizeQuestionText(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeAnswer(text: string): string {
  return normalizeQuestionText(text);
}

export function dedupeKey(question: string, answer: string): string {
  return `${normalizeQuestionText(question)}|${normalizeAnswer(answer)}`;
}

export function isPlayable(question: Question): boolean {
  return (
    question.active &&
    question.quality_score >= PLAYABLE_QUALITY &&
    question.choices.length >= 2 &&
    Boolean(question.question.trim())
  );
}

export function isBossQuestion(question: Question, isLastInRound: boolean): boolean {
  return isLastInRound || question.question_type === 'BOSS';
}

export function categoryLabel(category: MasterCategory | string): string {
  return category;
}
