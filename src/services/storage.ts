import AsyncStorage from '@react-native-async-storage/async-storage';
import { FAMILY_PLAYERS, MOCK_LEADERBOARD } from '../data/players';
import type { GameSettings, LeaderboardRow, Player } from '../types';

const PLAYERS_KEY = '@sta/players';
const SETTINGS_KEY = '@sta/settings';
const LEADERBOARD_KEY = '@sta/leaderboard';

export const DEFAULT_SETTINGS: GameSettings = {
  questionCount: 10,
  answerMode: 'shout',
  difficulty: 'adaptive',
  timerSeconds: 15,
  voiceEnabled: true,
  beatTheAi: false,
  hostVoice: 'british-female',
  hostMode: 'AI_HOST_PLUS_HUMAN_CLICKER',
};

export interface PersistedState {
  players: Player[];
  settings: GameSettings;
  leaderboard: LeaderboardRow[];
}

export async function loadPersisted(): Promise<PersistedState> {
  try {
    const [playersRaw, settingsRaw, boardRaw] = await Promise.all([
      AsyncStorage.getItem(PLAYERS_KEY),
      AsyncStorage.getItem(SETTINGS_KEY),
      AsyncStorage.getItem(LEADERBOARD_KEY),
    ]);

    const players = playersRaw
      ? (JSON.parse(playersRaw) as Player[]).map((p) => ({
          ...p,
          score: 0,
          enrolled: Boolean(p.isAi),
        }))
      : FAMILY_PLAYERS.map((p) => ({ ...p }));

    const settings = settingsRaw
      ? { ...DEFAULT_SETTINGS, ...(JSON.parse(settingsRaw) as Partial<GameSettings>) }
      : DEFAULT_SETTINGS;

    const leaderboard = boardRaw
      ? (JSON.parse(boardRaw) as LeaderboardRow[])
      : MOCK_LEADERBOARD;

    return { players, settings, leaderboard };
  } catch {
    return {
      players: FAMILY_PLAYERS.map((p) => ({ ...p })),
      settings: DEFAULT_SETTINGS,
      leaderboard: MOCK_LEADERBOARD,
    };
  }
}

export async function savePlayers(players: Player[]): Promise<void> {
  const sanitized = players
    .filter((p) => !p.isAi)
    .map(({ score: _score, enrolled: _enrolled, ...rest }) => ({
      ...rest,
      score: 0,
      enrolled: false,
    }));
  await AsyncStorage.setItem(PLAYERS_KEY, JSON.stringify(sanitized));
}

export async function saveSettings(settings: GameSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function saveLeaderboard(rows: LeaderboardRow[]): Promise<void> {
  await AsyncStorage.setItem(LEADERBOARD_KEY, JSON.stringify(rows));
}

export function mergeLeaderboard(
  existing: LeaderboardRow[],
  finishers: { name: string; emoji: string; score: number }[],
): LeaderboardRow[] {
  const byName = new Map(existing.map((row) => [row.name.toLowerCase(), { ...row }]));
  const ranked = [...finishers].sort((a, b) => b.score - a.score);
  ranked.forEach((finisher, index) => {
    const key = finisher.name.toLowerCase();
    const prev = byName.get(key);
    byName.set(key, {
      name: finisher.name,
      emoji: finisher.emoji,
      wins: (prev?.wins ?? 0) + (index === 0 && finisher.score > 0 ? 1 : 0),
      lastScore: finisher.score,
    });
  });
  return [...byName.values()].sort((a, b) => b.wins - a.wins || b.lastScore - a.lastScore);
}
