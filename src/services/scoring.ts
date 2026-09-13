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
): number {
  if (!correct) {
    return 0;
  }
  return (100 + speedBonus(responseMs)) * multiplier;
}
