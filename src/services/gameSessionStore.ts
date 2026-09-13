import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  GAME_SESSION_SAVE_VERSION,
  migrateSession,
  summarizeSession,
} from '../game/gameSession';
import type { GameSession, GameSessionSummary } from '../types';

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const INDEX_KEY = '@sta/sessions/index';
const ACTIVE_KEY = '@sta/sessions/active';

function sessionKey(id: string): string {
  return `@sta/sessions/${id}`;
}

function tmpKey(id: string): string {
  return `${sessionKey(id)}.tmp`;
}

export async function atomicWrite(
  store: KeyValueStore,
  key: string,
  value: string,
): Promise<void> {
  const tmp = `${key}.tmp`;
  await store.setItem(tmp, value);
  await store.setItem(key, value);
  await store.removeItem(tmp);
}

async function readJson<T>(store: KeyValueStore, key: string): Promise<T | null> {
  const raw = (await store.getItem(key)) ?? (await store.getItem(`${key}.tmp`));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function createGameSessionStore(store: KeyValueStore = AsyncStorage) {
  async function loadIndex(): Promise<GameSessionSummary[]> {
    const rows = (await readJson<GameSessionSummary[]>(store, INDEX_KEY)) ?? [];
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async function writeIndex(rows: GameSessionSummary[]): Promise<void> {
    await atomicWrite(store, INDEX_KEY, JSON.stringify(rows));
  }

  async function upsertIndex(session: GameSession): Promise<void> {
    const rows = await loadIndex();
    const summary = summarizeSession(session);
    const next = [summary, ...rows.filter((row) => row.id !== session.id)];
    await writeIndex(next);
  }

  async function saveSession(session: GameSession): Promise<GameSession> {
    const stamped: GameSession = {
      ...session,
      saveVersion: GAME_SESSION_SAVE_VERSION,
      updatedAt: Date.now(),
    };
    const json = JSON.stringify(stamped);
    await atomicWrite(store, sessionKey(stamped.id), json);
    await upsertIndex(stamped);
    await store.setItem(ACTIVE_KEY, stamped.id);
    return stamped;
  }

  async function loadSession(id: string): Promise<GameSession | null> {
    const raw =
      (await readJson<unknown>(store, sessionKey(id))) ??
      (await readJson<unknown>(store, tmpKey(id)));
    return migrateSession(raw);
  }

  async function loadActiveSession(): Promise<GameSession | null> {
    const id = await store.getItem(ACTIVE_KEY);
    if (!id) {
      return null;
    }
    return loadSession(id);
  }

  async function listSessions(): Promise<GameSessionSummary[]> {
    return loadIndex();
  }

  async function unfinishedSessions(): Promise<GameSessionSummary[]> {
    return (await loadIndex()).filter((row) => row.status === 'in_progress');
  }

  async function pastSessions(): Promise<GameSessionSummary[]> {
    return (await loadIndex()).filter((row) => row.status !== 'in_progress');
  }

  async function renameSession(id: string, name: string): Promise<GameSession | null> {
    const session = await loadSession(id);
    if (!session) {
      return null;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      return session;
    }
    return saveSession({ ...session, name: trimmed });
  }

  async function deleteSession(id: string): Promise<void> {
    const rows = (await loadIndex()).filter((row) => row.id !== id);
    await writeIndex(rows);
    await store.removeItem(sessionKey(id));
    await store.removeItem(tmpKey(id));
    const active = await store.getItem(ACTIVE_KEY);
    if (active === id) {
      await store.removeItem(ACTIVE_KEY);
    }
  }

  async function clearActive(): Promise<void> {
    await store.removeItem(ACTIVE_KEY);
  }

  return {
    saveSession,
    loadSession,
    loadActiveSession,
    listSessions,
    unfinishedSessions,
    pastSessions,
    renameSession,
    deleteSession,
    clearActive,
  };
}

export const gameSessionStore = createGameSessionStore();

export class MemoryStore implements KeyValueStore {
  private readonly data = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.data.delete(key);
  }
}
