import type {
  GameEvent,
  GameSession,
  GameSessionStatus,
  GameSessionSummary,
  GameSettings,
  PendingAnswer,
  Player,
  Question,
  QuestionDifficulty,
  RoundPhase,
  RoundResult,
} from '../types';

export const GAME_SESSION_SAVE_VERSION = 1;

export function createSessionId(): string {
  return `gs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultSessionName(players: Player[], now = Date.now()): string {
  const humans = players.filter((p) => !p.isAi).map((p) => p.name);
  const when = new Date(now).toLocaleString();
  const who = humans.length ? humans.join(', ') : 'Party';
  return `${who} · ${when}`;
}

export function createGameSession(input: {
  settings: GameSettings;
  players: Player[];
  questionOrder: string[];
  remainingQuestionIds: string[];
  currentQuestionId: string | null;
  questionNumber: number;
  name?: string;
  now?: number;
}): GameSession {
  const now = input.now ?? Date.now();
  return {
    saveVersion: GAME_SESSION_SAVE_VERSION,
    id: createSessionId(),
    name: input.name ?? defaultSessionName(input.players, now),
    status: 'in_progress',
    createdAt: now,
    updatedAt: now,
    settings: input.settings,
    players: input.players.map((p) => ({ ...p })),
    questionOrder: [...input.questionOrder],
    remainingQuestionIds: [...input.remainingQuestionIds],
    questionNumber: input.questionNumber,
    questionTotal: input.settings.questionCount,
    currentQuestionId: input.currentQuestionId,
    questionState: 'QUESTION_SELECTED',
    questionAttempts: [],
    lockoutPlayerIds: [],
    remainingTimeMs: input.settings.timerSeconds * 1000,
    results: [],
    eventLog: [],
    adaptiveLevel:
      input.settings.difficulty === 'easy'
        ? 'easy'
        : input.settings.difficulty === 'hard'
          ? 'hard'
          : 'medium',
    turnIndex: 0,
    isBoss: false,
    pendingAnswer: null,
    buzzedPlayerId: null,
    questionSessionId: '',
    hostLine: '',
    tiebreakActive: false,
  };
}

export function summarizeSession(session: GameSession): GameSessionSummary {
  return {
    id: session.id,
    name: session.name,
    status: session.status,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    questionNumber: session.questionNumber,
    questionTotal: session.questionTotal,
    playerNames: session.players.filter((p) => !p.isAi).map((p) => p.name),
  };
}

export function isResumable(session: GameSession | null | undefined): boolean {
  return Boolean(session && session.status === 'in_progress' && session.currentQuestionId);
}

export function restoreQuestionOrder(
  questionOrder: string[],
  remainingQuestionIds: string[],
  byId: (id: string) => Question | undefined,
): { current: Question | null; remaining: Question[]; orderValid: boolean } {
  const remaining = remainingQuestionIds
    .map(byId)
    .filter((q): q is Question => Boolean(q));
  const currentId = questionOrder.find(
    (id) => !remainingQuestionIds.includes(id) && Boolean(byId(id)),
  );
  return {
    current: currentId ? (byId(currentId) ?? null) : null,
    remaining,
    orderValid: remaining.length === remainingQuestionIds.length,
  };
}

export function remainingIdsFromDeck(
  order: string[],
  currentQuestionId: string | null,
): string[] {
  if (!currentQuestionId) {
    return [...order];
  }
  const index = order.indexOf(currentQuestionId);
  if (index < 0) {
    return order.filter((id) => id !== currentQuestionId);
  }
  return order.slice(index + 1);
}

export function patchSession(
  session: GameSession,
  patch: Partial<GameSession>,
  now = Date.now(),
): GameSession {
  return {
    ...session,
    ...patch,
    saveVersion: GAME_SESSION_SAVE_VERSION,
    id: session.id,
    createdAt: session.createdAt,
    updatedAt: now,
  };
}

export function markSessionStatus(
  session: GameSession,
  status: GameSessionStatus,
  now = Date.now(),
): GameSession {
  return patchSession(session, { status }, now);
}

export function migrateSession(raw: unknown): GameSession | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const session = raw as Partial<GameSession>;
  if (!session.id || !session.settings || !Array.isArray(session.questionOrder)) {
    return null;
  }
  return {
    saveVersion: GAME_SESSION_SAVE_VERSION,
    id: session.id,
    name: session.name ?? 'Saved game',
    status: session.status ?? 'in_progress',
    createdAt: session.createdAt ?? Date.now(),
    updatedAt: session.updatedAt ?? Date.now(),
    settings: session.settings,
    players: session.players ?? [],
    questionOrder: session.questionOrder,
    remainingQuestionIds: session.remainingQuestionIds ?? [],
    questionNumber: session.questionNumber ?? 1,
    questionTotal: session.questionTotal ?? session.settings.questionCount,
    currentQuestionId: session.currentQuestionId ?? null,
    questionState: (session.questionState as RoundPhase | undefined) ?? 'WAITING_FOR_ANSWERS',
    questionAttempts: session.questionAttempts ?? [],
    lockoutPlayerIds: session.lockoutPlayerIds ?? [],
    remainingTimeMs: session.remainingTimeMs ?? session.settings.timerSeconds * 1000,
    results: (session.results as RoundResult[] | undefined) ?? [],
    eventLog: (session.eventLog as GameEvent[] | undefined) ?? [],
    adaptiveLevel: (session.adaptiveLevel as QuestionDifficulty | undefined) ?? 'medium',
    turnIndex: session.turnIndex ?? 0,
    isBoss: Boolean(session.isBoss),
    pendingAnswer: (session.pendingAnswer as PendingAnswer | null | undefined) ?? null,
    buzzedPlayerId: session.buzzedPlayerId ?? null,
    questionSessionId: session.questionSessionId ?? '',
    hostLine: session.hostLine ?? '',
  };
}
