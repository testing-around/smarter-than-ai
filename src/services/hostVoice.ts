import type { HostVoiceMode } from '../types';

export interface HostVoicePick {
  identifier?: string;
  language: string;
  name: string;
  source: 'british-female' | 'system-fallback';
}

type SpeechMod = typeof import('expo-speech');
type VoiceInfo = { identifier: string; name: string; language: string; quality?: string };

const FEMALE_HINT =
  /female|woman|hazel|susan|libby|sonia|kate|serena|martha|moira|tessa|fiona|karen|samantha|victoria|zira|jenny|aria|natasha|allison|salli|ivy|joanna|kendra|kimberly|nicole|olivia|emily|uk english female/i;
const MALE_HINT =
  /male|david|daniel|george|oliver|rishi|thomas|fred|arthur|brian|guy|matthew|justin|kevin|steven|tom\b/i;
const PREFERRED_NAME =
  /google uk english female|microsoft (hazel|libby|susan|sonia)|libby|hazel|serena|kate/i;

let cached: HostVoicePick | null = null;
let mode: HostVoiceMode = 'british-female';

export function setHostVoiceMode(next: HostVoiceMode): void {
  if (mode !== next) {
    cached = null;
  }
  mode = next;
}

export function getHostVoiceMode(): HostVoiceMode {
  return mode;
}

function scoreVoice(voice: VoiceInfo): number {
  const lang = voice.language.replace('_', '-');
  let score = 0;
  if (/^en-GB/i.test(lang)) {
    score += 50;
  } else if (/^en-AU/i.test(lang)) {
    score += 18;
  } else if (/^en/i.test(lang)) {
    score += 6;
  }
  if (PREFERRED_NAME.test(voice.name) || PREFERRED_NAME.test(voice.identifier)) {
    score += 35;
  }
  if (FEMALE_HINT.test(voice.name) || FEMALE_HINT.test(voice.identifier)) {
    score += 28;
  }
  if (MALE_HINT.test(voice.name)) {
    score -= 30;
  }
  if (voice.quality === 'Enhanced') {
    score += 8;
  }
  return score;
}

async function listVoices(mod: SpeechMod): Promise<VoiceInfo[]> {
  try {
    let voices = await mod.getAvailableVoicesAsync();
    if (voices.length === 0 && typeof globalThis !== 'undefined') {
      const synth = (globalThis as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
      if (synth) {
        await new Promise<void>((resolve) => {
          const done = () => resolve();
          synth.addEventListener('voiceschanged', done, { once: true });
          setTimeout(done, 350);
        });
        voices = await mod.getAvailableVoicesAsync();
      }
    }
    return voices.map((voice) => ({
      identifier: voice.identifier,
      name: voice.name,
      language: voice.language,
      quality: 'quality' in voice ? String(voice.quality) : undefined,
    }));
  } catch {
    return [];
  }
}

export async function pickBritishFemaleHostVoice(): Promise<HostVoicePick> {
  if (mode === 'system') {
    return { language: 'en-US', name: 'System default', source: 'system-fallback' };
  }
  if (cached) {
    return cached;
  }

  const fallback: HostVoicePick = {
    language: 'en-GB',
    name: 'en-GB (no named female voice on this device)',
    source: 'system-fallback',
  };

  try {
    const mod = await import('expo-speech');
    const voices = await listVoices(mod);
    if (!voices.length) {
      cached = fallback;
      return cached;
    }
    const ranked = [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
    const best = ranked[0];
    if (!best || scoreVoice(best) < 20) {
      cached = fallback;
      return cached;
    }
    cached = {
      identifier: best.identifier,
      language: best.language.replace('_', '-') || 'en-GB',
      name: best.name,
      source: 'british-female',
    };
    return cached;
  } catch {
    cached = fallback;
    return cached;
  }
}

export async function warmHostVoice(): Promise<HostVoicePick> {
  return pickBritishFemaleHostVoice();
}

export function hostSpeechOptions(pick: HostVoicePick): {
  language: string;
  voice?: string;
  pitch: number;
  rate: number;
} {
  if (mode === 'system') {
    return { language: 'en-US', pitch: 1.0, rate: 1.0 };
  }
  return {
    language: pick.language.startsWith('en') ? pick.language : 'en-GB',
    voice: pick.identifier,
    pitch: 1.08,
    rate: 1.06,
  };
}
