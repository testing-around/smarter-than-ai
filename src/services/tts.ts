import { brandWelcome } from '../branding';
import { pickWinnerLine } from '../game/winnerEngine';
import {
  getHostVoiceMode,
  hostSpeechOptions,
  pickBritishFemaleHostVoice,
  setHostVoiceMode,
  type HostVoicePick,
} from './hostVoice';
import type { HostVoiceMode, TtsOutcome } from '../types';

let enabled = true;
type SpeechModule = typeof import('expo-speech');
let speech: SpeechModule | null | undefined;
let lastPick: HostVoicePick | null = null;
let utteranceSeq = 0;
let hostTtsActive = false;
const ttsIdleWaiters: Array<() => void> = [];

function setHostTtsActive(active: boolean): void {
  hostTtsActive = active;
  if (!active) {
    while (ttsIdleWaiters.length) {
      ttsIdleWaiters.shift()?.();
    }
  }
}

export function isHostTtsActive(): boolean {
  return hostTtsActive;
}

export function waitForHostTtsIdle(bufferMs = 350, timeoutMs = 20000): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      setTimeout(resolve, bufferMs);
    };
    const timer = setTimeout(() => {
      setHostTtsActive(false);
      finish();
    }, timeoutMs);
    const done = () => {
      clearTimeout(timer);
      finish();
    };
    if (!hostTtsActive) {
      done();
      return;
    }
    ttsIdleWaiters.push(done);
  });
}

export interface HostSayRequest {
  sessionId: string;
  isCurrent: () => boolean;
}

async function load(): Promise<SpeechModule | null> {
  if (speech !== undefined) {
    return speech;
  }
  try {
    speech = await import('expo-speech');
    return speech;
  } catch {
    speech = null;
    return null;
  }
}

export function setTtsEnabled(value: boolean): void {
  enabled = value;
}

export function configureHostVoice(mode: HostVoiceMode): void {
  setHostVoiceMode(mode);
  lastPick = null;
}

export async function stopHostVoice(): Promise<void> {
  utteranceSeq += 1;
  setHostTtsActive(false);
  try {
    const mod = await load();
    await mod?.stop();
  } catch {
    // ignore
  }
}

/**
 * Speak host copy and resolve only from expo-speech callbacks.
 * Never uses estimated duration timers.
 */
export async function hostSay(line: string, request?: HostSayRequest): Promise<TtsOutcome> {
  const trimmed = line.trim();
  if (!enabled) {
    return 'disabled';
  }
  if (!trimmed) {
    return 'empty';
  }

  const myId = ++utteranceSeq;
  const live = (): boolean => {
    if (myId !== utteranceSeq) {
      return false;
    }
    return request ? request.isCurrent() : true;
  };

  try {
    const mod = await load();
    if (!mod) {
      return 'unavailable';
    }
    await mod.stop();
    if (!live()) {
      return 'stale';
    }
    if (getHostVoiceMode() === 'british-female' && !lastPick) {
      lastPick = await pickBritishFemaleHostVoice();
    }
    if (!live()) {
      return 'stale';
    }
    const pick =
      lastPick ??
      ({
        language: getHostVoiceMode() === 'british-female' ? 'en-GB' : 'en-US',
        name: 'pending',
        source: 'system-fallback' as const,
      } satisfies HostVoicePick);
    const options = hostSpeechOptions(pick);

    return await new Promise<TtsOutcome>((resolve) => {
      let settled = false;
      const finish = (outcome: TtsOutcome) => {
        if (settled) {
          return;
        }
        settled = true;
        if (myId === utteranceSeq) {
          setHostTtsActive(false);
        }
        if (!live()) {
          resolve('stale');
          return;
        }
        resolve(outcome);
      };

      try {
        setHostTtsActive(true);
        mod.speak(trimmed, {
          ...options,
          onDone: () => finish('done'),
          onStopped: () => finish('stopped'),
          onError: () => finish('error'),
        });
      } catch {
        finish('error');
      }
    });
  } catch {
    return 'error';
  }
}

export const hostCopy = {
  welcome: brandWelcome(),
  lobby: (names: string) => `Players ready: ${names}. Tap start when the room is loud.`,
  question: (n: number, category: string) => `Question ${n}. ${category}.`,
  boss: 'Boss round. Triple points. Do not choke.',
  correct: (name: string) => `${name} got it!`,
  wrong: (name: string) => `Not this time, ${name}.`,
  timeout: 'Still open. Listen again.',
  skip: 'Skipping this one.',
  reveal: (answer: string) => `The answer is ${answer}.`,
  who: (heard?: string) => (heard ? `Who said ${heard}?` : 'Who said that?'),
  winner: (name: string) => pickWinnerLine(name),
  asking: 'Hold your answers. The host is still speaking.',
  listening: 'Listening for answers.',
};
