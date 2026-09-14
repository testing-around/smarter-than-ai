import type { EnrollmentPhraseId, EnrollmentSample, VoiceProfile } from '../types';
import { meanEmbedding } from '../voice/audioFeatures';
import {
  EMBEDDING_MODEL,
  MAX_SAMPLE_MS,
  MIN_SAMPLE_MS,
  MIN_TRANSCRIPT_CHARS,
  MIN_VALID_SAMPLES,
} from '../voice/constants';

export const PHRASES_REQUIRED = MIN_VALID_SAMPLES;

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
      prompt: `My name is ${who} and I am ready to play Smarter Than AI`,
      expected: `my name is ${who} and i am ready to play smarter than ai`,
      requireName: true,
    },
    {
      id: 'yes',
      prompt: 'Yes, I know this one and I am sure of my answer',
      expected: 'yes i know this one and i am sure of my answer',
      requireName: false,
    },
    {
      id: 'no',
      prompt: 'No, that is not the answer I wanted to give',
      expected: 'no that is not the answer i wanted to give',
      requireName: false,
    },
    {
      id: 'know',
      prompt: 'I know the answer and I want to shout it out now',
      expected: 'i know the answer and i want to shout it out now',
      requireName: false,
    },
    {
      id: 'name',
      prompt: `${who} is speaking now and this is my trained voice`,
      expected: `${who} is speaking now and this is my trained voice`,
      requireName: true,
    },
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

/** Score 0–1. Short yes/no must actually contain yes/no — not any long utterance. */
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

  if (phrase.id === 'yes' && !heard.some((word) => YES.has(word))) {
    return 0;
  }
  if (phrase.id === 'no') {
    if (!heard.some((word) => NO.has(word))) {
      return 0;
    }
    if (heard.some((word) => YES.has(word))) {
      return 0;
    }
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

export function classifySampleQuality(
  sample: Pick<EnrollmentSample, 'durationMs' | 'transcript' | 'matchScore' | 'speechDetected'>,
): EnrollmentSample['quality'] {
  if (sample.durationMs < MIN_SAMPLE_MS) {
    return 'too-short';
  }
  if (sample.durationMs > MAX_SAMPLE_MS) {
    return 'too-long';
  }
  if (sample.speechDetected === false) {
    return 'silence';
  }
  if ((sample.transcript ?? '').trim().length < MIN_TRANSCRIPT_CHARS) {
    return 'silence';
  }
  if (!phrasePassed(sample.matchScore)) {
    return 'mismatch';
  }
  return 'ok';
}

export function sampleIsValid(sample: EnrollmentSample): boolean {
  const quality = sample.quality ?? classifySampleQuality(sample);
  return quality === 'ok' && phrasePassed(sample.matchScore);
}

export function buildVoiceProfile(
  playerId: string,
  name: string,
  samples: EnrollmentSample[],
): VoiceProfile {
  const annotated = samples.map((sample) => ({
    ...sample,
    quality: sample.quality ?? classifySampleQuality(sample),
    audioUri: null,
  }));
  const passed = annotated.filter((sample) => sampleIsValid(sample));
  const embeddings = passed
    .map((sample) => sample.embedding)
    .filter((item): item is number[] => Array.isArray(item) && item.some((value) => value !== 0));
  const centroid = meanEmbedding(embeddings);
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
  const offlineReady = embeddings.length >= MIN_VALID_SAMPLES && Boolean(centroid);

  return {
    playerId,
    name,
    enrollmentSamples: annotated,
    enrolledAt: Date.now(),
    quality: {
      phrasesPassed: passed.length,
      phrasesRequired: PHRASES_REQUIRED,
      hasAudio: embeddings.length > 0 || passed.some((sample) => Boolean(sample.speechDetected)),
      voiceReady: passed.length >= PHRASES_REQUIRED,
    },
    meanDurationMs,
    meanSpeechRate,
    embeddings,
    centroid,
    embeddingModel: embeddings.length ? EMBEDDING_MODEL : null,
    samplesAccepted: passed.length,
    locale: 'en-US',
    offlineReady,
  };
}

export function canMarkVoiceReady(profile: VoiceProfile | null): boolean {
  return Boolean(profile?.quality.voiceReady && (profile.samplesAccepted ?? profile.enrollmentSamples.length) > 0);
}

export function voiceProfileStatus(
  profile: VoiceProfile | null,
): 'TRAINED' | 'NEEDS TRAINING' | 'UNTRAINED' {
  if (!profile) {
    return 'UNTRAINED';
  }
  return profile.quality.voiceReady ? 'TRAINED' : 'NEEDS TRAINING';
}
