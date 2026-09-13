import { canStartListening } from '../game/phases';
import { isLiveSession } from '../game/session';
import type { RoundPhase } from '../types';
import { startListening, stopListening, type VoiceListeners } from './voice';

export interface ListeningGate {
  sessionId: string;
  phase: RoundPhase;
  hostSpeaking: boolean;
  listeningEnabled: boolean;
  earlyShoutOut: boolean;
}

export function shouldOpenMic(gate: ListeningGate): boolean {
  return canStartListening(
    gate.phase,
    gate.hostSpeaking,
    gate.listeningEnabled,
    gate.earlyShoutOut,
  );
}

/**
 * Contestant STT. Default (P2): never start while the host is speaking.
 * Early shout-out is the explicit exception: mic may open during HOST_SPEAKING.
 * Stale callbacks from a previous question session are always ignored.
 */
export async function startPlayerListening(
  getGate: () => ListeningGate,
  contextualStrings: string[],
  listeners: VoiceListeners,
): Promise<boolean> {
  const opened = getGate();
  if (!shouldOpenMic(opened)) {
    await stopListening();
    return false;
  }

  const sessionAtStart = opened.sessionId;
  const guarded: VoiceListeners = {
    onStart: () => {
      const gate = getGate();
      if (isLiveSession(sessionAtStart, gate.sessionId) && shouldOpenMic(gate)) {
        listeners.onStart?.();
      }
    },
    onEnd: () => listeners.onEnd?.(),
    onError: (message) => listeners.onError?.(message),
    onPartial: (text) => {
      const gate = getGate();
      if (!isLiveSession(sessionAtStart, gate.sessionId) || !shouldOpenMic(gate)) {
        return;
      }
      listeners.onPartial?.(text);
    },
    onFinal: (text) => {
      const gate = getGate();
      if (!isLiveSession(sessionAtStart, gate.sessionId) || !shouldOpenMic(gate)) {
        return;
      }
      listeners.onFinal?.(text);
    },
  };

  return startListening(contextualStrings, guarded);
}

export async function closePlayerMic(): Promise<void> {
  await stopListening();
}
