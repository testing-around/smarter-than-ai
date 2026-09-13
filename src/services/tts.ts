import {
  getHostVoiceMode,
  hostSpeechOptions,
  pickBritishFemaleHostVoice,
  setHostVoiceMode,
  type HostVoicePick,
} from './hostVoice';
import type { HostVoiceMode } from '../types';

let enabled = true;
type SpeechModule = typeof import('expo-speech');
let speech: SpeechModule | null | undefined;
let lastPick: HostVoicePick | null = null;

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

export async function hostSay(line: string): Promise<void> {
  if (!enabled || !line.trim()) {
    return;
  }
  try {
    const mod = await load();
    if (!mod) {
      return;
    }
    await mod.stop();
    if (getHostVoiceMode() === 'british-female' && !lastPick) {
      lastPick = await pickBritishFemaleHostVoice();
    }
    const pick =
      lastPick ??
      ({
        language: getHostVoiceMode() === 'british-female' ? 'en-GB' : 'en-US',
        name: 'pending',
        source: 'system-fallback' as const,
      } satisfies HostVoicePick);
    const options = hostSpeechOptions(pick);
    mod.speak(line, options);
  } catch {
    // TTS is a bonus. Never block the round.
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
  who: 'Who said that?',
  winner: (name: string) => `${name} is smarter than AI. For now.`,
};
