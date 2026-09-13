import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildVoiceProfile } from '../game/enrollmentMachine';
import type { EnrollmentSample, Player, VoiceProfile } from '../types';
import { extractBandEmbedding } from './audioFeatures';
import {
  SPEAKER_AUTO_THRESHOLD,
  calibratedFromCosine,
  guessSpeaker,
  shouldAskWhoSaidThat,
} from './speakerEngine';

const players: Player[] = [
  { id: 'p1', name: 'Damian', emoji: '🧠', score: 0, enrolled: true, voiceReady: true },
  { id: 'p2', name: 'Dorian', emoji: '🦖', score: 0, enrolled: true, voiceReady: true },
];

function sine(freq: number, seconds = 1.8, sampleRate = 16000): Float32Array {
  const samples = new Float32Array(Math.round(sampleRate * seconds));
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = 0.32 * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return samples;
}

function sample(phraseId: EnrollmentSample['phraseId'], freq: number): EnrollmentSample {
  const embedding = extractBandEmbedding({ sampleRate: 16000, samples: sine(freq) }).vector;
  const transcript =
    phraseId === 'ready'
      ? 'My name is Damian and I am ready to play Smarter Than AI'
      : phraseId === 'yes'
        ? 'Yes I know this one and I am sure of my answer'
        : 'No that is not the answer I wanted to give';
  return {
    phraseId,
    prompt: transcript,
    transcript,
    durationMs: 1800,
    audioUri: null,
    matchScore: 1,
    capturedAt: Date.now(),
    embedding,
    speechDetected: true,
  };
}

function profile(playerId: string, name: string, freq: number): VoiceProfile {
  return buildVoiceProfile(playerId, name, [
    sample('ready', freq),
    sample('yes', freq + 8),
    sample('no', freq - 8),
  ]);
}

describe('speaker engine', () => {
  it('does not treat raw cosine as a percent', () => {
    assert.ok(calibratedFromCosine(0.2) < 0.5);
    assert.ok(calibratedFromCosine(0.9) > 0.9);
    assert.notEqual(calibratedFromCosine(0.4), 0.4);
  });

  it('auto-assigns an enrolled name match at >= 70%', () => {
    const guess = guessSpeaker('Damian, B', 800, players, [profile('p1', 'Damian', 180)]);
    assert.equal(guess.playerId, 'p1');
    assert.ok(guess.confidence >= SPEAKER_AUTO_THRESHOLD);
    assert.equal(shouldAskWhoSaidThat(guess), false);
  });

  it('asks who said that when two speakers are too close', () => {
    const shared = profile('p1', 'Damian', 200);
    const clone: VoiceProfile = {
      ...shared,
      playerId: 'p2',
      name: 'Dorian',
    };
    const probe = shared.centroid ?? shared.embeddings?.[0] ?? [];
    const guess = guessSpeaker('option B', 1600, players, [shared, clone], probe);
    assert.equal(shouldAskWhoSaidThat(guess), true);
    assert.equal(guess.playerId, null);
    assert.equal(guess.ambiguous, true);
  });

  it('never auto-assigns from duration/timing alone', () => {
    const guess = guessSpeaker('B', 1800, players, [profile('p1', 'Damian', 180)]);
    assert.ok(guess.confidence < SPEAKER_AUTO_THRESHOLD);
    assert.equal(shouldAskWhoSaidThat(guess), true);
  });
});
