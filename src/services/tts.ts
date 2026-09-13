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
        if (!live()) {
          resolve('stale');
          return;
        }
        resolve(outcome);
      };

      try {
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
  welcome: 'Welcome to Smarter Than AI. Enter your names and get ready to shout.',
  lobby: (names: string) => `Players ready: ${names}. Tap start when the room is loud.`,
  question: (n: number, category: string) => `Question ${n}. ${category}.`,
  boss: 'Boss round. Triple points. Do not choke.',
  correct: (name: string) => `${name} got it!`,
  wrong: (name: string) => `Not this time, ${name}.`,
  timeout: 'Time. Nobody claimed it.',
  who: (heard?: string) => (heard ? `Who said ${heard}?` : 'Who said that?'),
  winner: (name: string) => `${name} is smarter than AI. For now.`,
  asking: 'Hold your answers. The host is still speaking.',
  listening: 'Listening for answers.',
};
