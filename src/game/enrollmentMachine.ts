import type { EnrollmentPhraseId, EnrollmentSample, VoiceProfile } from '../types';

export const PHRASES_REQUIRED = 3;

export interface EnrollmentPhrase {
  id: EnrollmentPhraseId;
  prompt: string;
  expected: string;
  requireName: boolean;
}

export type EnrollmentPhase =
  | 'IDLE'
  | 'NEED_PERMISSION'
  | 'LISTENING'
  | 'SCORING'
  | 'PHRASE_PASS'
  | 'PHRASE_FAIL'
  | 'COMPLETE'
  | 'FAILED';

export function enrollmentPhrases(name: string): EnrollmentPhrase[] {
  const who = name.trim() || 'Player';
  return [
    {
      id: 'ready',
      prompt: `My name is ${who} and I'm ready to play`,
      expected: `my name is ${who} and im ready to play`,
      requireName: true,
    },
    { id: 'yes', prompt: 'Yes', expected: 'yes', requireName: false },
    { id: 'no', prompt: 'No', expected: 'no', requireName: false },
    {
      id: 'know',
      prompt: 'I know the answer',
      expected: 'i know the answer',
      requireName: false,
    },
    { id: 'name', prompt: who, expected: who.toLowerCase(), requireName: true },
  ];
}

export function normalizeEnrollment(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text: string): string[] {
  return normalizeEnrollment(text).split(' ').filter(Boolean);
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const grid: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (__, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const prev = grid[i - 1];
      const cur = grid[i];
      if (!prev || !cur) {
        continue;
      }
      cur[j] = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
  }
  return grid[a.length]?.[b.length] ?? Math.max(a.length, b.length);
}

const YES = new Set(['yes', 'yeah', 'yep', 'yup']);
const NO = new Set(['no', 'nope', 'nah']);

/** Score 0–1. Short yes/no must actually be yes/no — not any long utterance. */
export function scorePhraseMatch(
  transcript: string,
  phrase: EnrollmentPhrase,
  playerName: string,
): number {
  const hay = normalizeEnrollment(transcript);
  if (!hay) {
    return 0;
  }
  const heard = tokens(transcript);
  const name = normalizeEnrollment(playerName);

  if (phrase.id === 'yes') {
    return heard.some((word) => YES.has(word)) && heard.length <= 4 ? 1 : 0;
  }
  if (phrase.id === 'no') {
    return heard.some((word) => NO.has(word)) && heard.length <= 4 ? 1 : 0;
  }

  if (phrase.requireName && name) {
    const nameHit =
      hay.includes(name) ||
      heard.some((word) => word.length >= 3 && levenshtein(word, name) <= 1);
    if (!nameHit) {
      return 0.15;
    }
  }

  const expectedTokens = tokens(phrase.expected);
  if (expectedTokens.length === 0) {
    return 0;
  }
  const hits = expectedTokens.filter((token) =>
    heard.some((word) => word === token || (token.length >= 4 && levenshtein(word, token) <= 1)),
  ).length;
  return hits / expectedTokens.length;
}

export const PHRASE_PASS_SCORE = 0.55;

export function phrasePassed(score: number): boolean {
  return score >= PHRASE_PASS_SCORE;
}

export function buildVoiceProfile(
  playerId: string,
  name: string,
  samples: EnrollmentSample[],
): VoiceProfile {
  const passed = samples.filter((sample) => phrasePassed(sample.matchScore));
  const withAudio = passed.filter((sample) => Boolean(sample.audioUri));
  const meanDurationMs =
    passed.length === 0
      ? 0
      : passed.reduce((sum, sample) => sum + sample.durationMs, 0) / passed.length;
  const meanSpeechRate =
    passed.length === 0
      ? 0
      : passed.reduce((sum, sample) => {
          const chars = sample.transcript.replace(/\s+/g, '').length;
          const seconds = Math.max(sample.durationMs, 1) / 1000;
          return sum + chars / seconds;
        }, 0) / passed.length;

  return {
    playerId,
    name,
    enrollmentSamples: samples,
    enrolledAt: Date.now(),
    quality: {
      phrasesPassed: passed.length,
      phrasesRequired: PHRASES_REQUIRED,
      hasAudio: withAudio.length > 0,
      voiceReady: passed.length >= PHRASES_REQUIRED,
    },
    meanDurationMs,
    meanSpeechRate,
  };
}

export function canMarkVoiceReady(profile: VoiceProfile | null): boolean {
  return Boolean(profile?.quality.voiceReady && profile.enrollmentSamples.length > 0);
}
