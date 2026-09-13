import { canStartListening } from '../game/phases';
import { isLiveSession } from '../game/session';
import type { RoundPhase } from '../types';
import { cancelListening, isRecognizerBusy, startListening, type VoiceListeners } from './voice';

export interface ListeningGate {
  sessionId: string;
  phase: RoundPhase;
  hostSpeaking: boolean;
  listeningEnabled: boolean;
  earlyShoutOut: boolean;
  repeating?: boolean;
}

export function shouldOpenMic(gate: ListeningGate): boolean {
  return canStartListening(
    gate.phase,
    gate.hostSpeaking,
    gate.listeningEnabled,
    gate.earlyShoutOut,
    Boolean(gate.repeating),
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
    if (isRecognizerBusy()) {
      await cancelListening('gate-closed');
    }
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
    onError: (message, meta) => {
      if (meta?.errorType === 'aborted') {
        return;
      }
      listeners.onError?.(message, meta);
    },
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
    onAudio: (uri) => listeners.onAudio?.(uri),
  };

  return startListening(contextualStrings, guarded, {
    persistRecording: true,
    continuous: true,
    preferOnDevice: true,
    contextualScreen: 'GAME',
  });
}

export async function closePlayerMic(): Promise<void> {
  await cancelListening('close-player-mic');
}
