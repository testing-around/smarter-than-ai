import type { Question } from '../types';

export function speedBonus(responseMs: number): number {
  if (responseMs < 2000) {
    return 50;
  }
  if (responseMs < 4000) {
    return 30;
  }
  return 15;
}

export function scoreForAnswer(
  correct: boolean,
  responseMs: number,
  multiplier: number,
  question?: Question,
): number {
  if (!correct) {
    return 0;
  }
  const base = question?.base_points ?? 100;
  const bonus = question?.speed_bonus === false ? 0 : speedBonus(responseMs);
  return (base + bonus) * multiplier;
}
