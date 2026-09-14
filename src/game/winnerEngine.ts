import { APP_NAME } from '../branding';
import type { Player } from '../types';
import { pickAvoidingRecent } from './hostPersonality';

const WINNER_LINES = [
  (name: string) => `${name} is the ${APP_NAME} champion!`,
  (name: string) => `${name} just proved they are Smarter Then AI!`,
  (name: string) => `Give it up for ${name} — tonight's winner!`,
  (name: string) => `${name} takes the crown. The machines can sit down.`,
  (name: string) => `Champion of the room: ${name}!`,
  (name: string) => `${name} did it! Smarter Then AI, indeed.`,
  (name: string) => `That's a wrap — ${name} wins it!`,
  (name: string) => `${name} leaves the AI in the dust.`,
];

export function pickWinnerLine(name: string): string {
  const who = name.trim() || 'this player';
  return pickAvoidingRecent(
    'winner',
    WINNER_LINES.map((line) => line(who)),
    6,
  );
}

export function neverRandomWinner(leaders: Player[]): Player | null {
  if (leaders.length === 1) {
    return leaders[0] ?? null;
  }
  return null;
}
