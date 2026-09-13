import type { GameEvent, GameEventType } from '../types';

const MAX_EVENTS = 80;

export function createGameEvent(
  type: GameEventType,
  sessionId: string,
  questionId: string | null,
  detail?: string,
): GameEvent {
  return {
    at: Date.now(),
    sessionId,
    questionId,
    type,
    detail,
  };
}

export function appendGameEvent(log: GameEvent[], event: GameEvent): GameEvent[] {
  const next = [...log, event];
  if (next.length <= MAX_EVENTS) {
    return next;
  }
  return next.slice(next.length - MAX_EVENTS);
}

export function formatEventLine(event: GameEvent): string {
  const clock = new Date(event.at).toISOString().slice(11, 23);
  const extra = event.detail ? ` ${event.detail}` : '';
  return `${clock} ${event.type}${extra}`;
}
