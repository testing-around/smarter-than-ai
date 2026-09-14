export type RecognizerState =
  | 'IDLE'
  | 'PREPARING'
  | 'LISTENING'
  | 'PROCESSING'
  | 'SAVING'
  | 'SUCCESS'
  | 'ERROR';

const LEGAL: Record<RecognizerState, readonly RecognizerState[]> = {
  IDLE: ['PREPARING'],
  PREPARING: ['LISTENING', 'ERROR', 'IDLE'],
  LISTENING: ['PROCESSING', 'ERROR', 'IDLE'],
  PROCESSING: ['SAVING', 'SUCCESS', 'ERROR', 'IDLE'],
  SAVING: ['SUCCESS', 'ERROR'],
  SUCCESS: ['IDLE', 'PREPARING'],
  ERROR: ['IDLE', 'PREPARING'],
};

export interface RecognitionSnapshot {
  state: RecognizerState;
  sessionId: number;
  abortRequested: boolean;
  startedAt: number | null;
  lastTransitionAt: number | null;
}

export interface RecognitionMachine {
  snapshot(): RecognitionSnapshot;
  canStart(): boolean;
  isBusy(): boolean;
  begin(): number;
  isCurrent(sessionId: number): boolean;
  shouldIgnoreCallback(sessionId: number): boolean;
  transition(sessionId: number, next: RecognizerState): boolean;
  requestAbort(sessionId: number): boolean;
  finish(sessionId: number, outcome: 'SUCCESS' | 'ERROR'): boolean;
  reset(): void;
}

export function createRecognitionMachine(): RecognitionMachine {
  let state: RecognizerState = 'IDLE';
  let sessionId = 0;
  let abortRequested = false;
  let startedAt: number | null = null;
  let lastTransitionAt: number | null = null;

  const setState = (next: RecognizerState): boolean => {
    if (state === next) {
      return true;
    }
    if (!LEGAL[state].includes(next)) {
      return false;
    }
    state = next;
    lastTransitionAt = Date.now();
    return true;
  };

  return {
    snapshot() {
      return { state, sessionId, abortRequested, startedAt, lastTransitionAt };
    },

    canStart() {
      return state === 'IDLE' || state === 'SUCCESS' || state === 'ERROR';
    },

    isBusy() {
      return (
        state === 'PREPARING' ||
        state === 'LISTENING' ||
        state === 'PROCESSING' ||
        state === 'SAVING'
      );
    },

    begin() {
      if (!this.canStart()) {
        return 0;
      }
      if (state === 'SUCCESS' || state === 'ERROR') {
        if (!setState('PREPARING')) {
          return 0;
        }
      } else if (!setState('PREPARING')) {
        return 0;
      }
      sessionId += 1;
      abortRequested = false;
      startedAt = Date.now();
      return sessionId;
    },

    isCurrent(id: number) {
      return id > 0 && id === sessionId;
    },

    shouldIgnoreCallback(id: number) {
      return id !== sessionId;
    },

    transition(id: number, next: RecognizerState) {
      if (id !== sessionId) {
        return false;
      }
      return setState(next);
    },

    requestAbort(id: number) {
      if (id !== sessionId) {
        return false;
      }
      if (state === 'IDLE' || state === 'SUCCESS' || state === 'ERROR') {
        return false;
      }
      abortRequested = true;
      return true;
    },

    finish(id: number, outcome: 'SUCCESS' | 'ERROR') {
      if (id !== sessionId) {
        return false;
      }
      if (outcome === 'SUCCESS' && abortRequested) {
        return setState('ERROR');
      }
      return setState(outcome);
    },

    reset() {
      state = 'IDLE';
      abortRequested = false;
      startedAt = null;
      lastTransitionAt = Date.now();
    },
  };
}

export const recognitionMachine = createRecognitionMachine();
