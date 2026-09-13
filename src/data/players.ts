import type { LeaderboardRow, Player } from '../types';

export const PLAYER_EMOJIS = [
  '🧠',
  '🦖',
  '⚡',
  '🦊',
  '🦄',
  '🐲',
  '🐱',
  '🐸',
  '🐼',
  '🚀',
  '🎯',
  '🌟',
  '🎮',
  '🔥',
  '💎',
] as const;

export const FAMILY_PLAYERS: Player[] = [
  { id: 'p-damian', name: 'Damian', emoji: '🧠', score: 0, enrolled: false },
  { id: 'p-dorian', name: 'Dorian', emoji: '🦖', score: 0, enrolled: false },
  { id: 'p-delissa', name: 'Delissa', emoji: '⚡', score: 0, enrolled: false },
];

export const AI_PLAYER: Player = {
  id: 'p-ai',
  name: 'A.I.',
  emoji: '🤖',
  score: 0,
  enrolled: true,
  isAi: true,
};

export const MOCK_LEADERBOARD: LeaderboardRow[] = [
  { name: 'Damian', emoji: '🧠', wins: 4, lastScore: 1280 },
  { name: 'Dorian', emoji: '🦖', wins: 3, lastScore: 1110 },
  { name: 'Delissa', emoji: '⚡', wins: 2, lastScore: 980 },
];

export function createPlayer(name: string, emoji: string): Player {
  return {
    id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    emoji,
    score: 0,
    enrolled: false,
  };
}
