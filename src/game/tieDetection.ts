import type { Player } from '../types';

export interface TieDetection {
  score: number;
  leaders: Player[];
  isTie: boolean;
}

export function contestants(players: Player[]): Player[] {
  return players.filter((player) => player.name.trim());
}

export function detectLeaders(players: Player[]): TieDetection {
  const roster = contestants(players);
  if (roster.length === 0) {
    return { score: 0, leaders: [], isTie: false };
  }
  const score = Math.max(...roster.map((player) => player.score));
  const leaders = roster.filter((player) => player.score === score);
  return {
    score,
    leaders,
    isTie: leaders.length >= 2,
  };
}

export function isPlayerInTiebreak(playerId: string, leaders: Player[]): boolean {
  return leaders.some((player) => player.id === playerId);
}

export function tieAnnouncement(leaders: Player[], score: number): string {
  const names = leaders.map((player) => player.name).join(' and ');
  if (leaders.length < 2) {
    return `${leaders[0]?.name ?? 'Someone'} leads with ${score}.`;
  }
  return `We have a tie at ${score} points between ${names}. Sudden death. Only the leaders can answer.`;
}
