import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SPEAKER_AUTO_THRESHOLD, guessSpeaker, shouldAskWhoSaidThat } from './speakerMatch';
import { buildVoiceProfile } from '../game/enrollmentMachine';
import type { EnrollmentSample, Player } from '../types';

const players: Player[] = [
  { id: 'p1', name: 'Damian', emoji: '🧠', score: 0, enrolled: true, voiceReady: true },
  { id: 'p2', name: 'Dorian', emoji: '🦖', score: 0, enrolled: false },
];

function readyProfile(playerId: string, name: string) {
  const samples: EnrollmentSample[] = [
    { phraseId: 'ready' as const, transcript: 'My name is Damian and I am ready to play' },
    { phraseId: 'yes' as const, transcript: 'Yes I know this one and I am sure' },
    { phraseId: 'no' as const, transcript: 'No that is not the answer' },
  ].map(({ phraseId, transcript }) => ({
    phraseId,
    prompt: transcript,
    transcript,
    durationMs: 1800,
    audioUri: null,
    matchScore: 1,
    capturedAt: Date.now(),
    embedding: [0.4, 0.2, 0.1],
    speechDetected: true,
  }));
  return buildVoiceProfile(playerId, name, samples);
}

describe('speaker match', () => {
  it('auto-assigns an enrolled name match at >= 70%', () => {
    const guess = guessSpeaker('Damian, B', 800, players, [readyProfile('p1', 'Damian')]);
    assert.equal(guess.playerId, 'p1');
    assert.ok(guess.confidence >= SPEAKER_AUTO_THRESHOLD);
    assert.equal(shouldAskWhoSaidThat(guess), false);
  });

  it('keeps unenrolled name matches below the auto threshold', () => {
    const guess = guessSpeaker('Dorian Mars', 800, players, []);
    assert.equal(guess.playerId, 'p2');
    assert.ok(guess.confidence < SPEAKER_AUTO_THRESHOLD);
    assert.equal(shouldAskWhoSaidThat(guess), true);
  });

  it('does not auto-assign from timing alone', () => {
    const guess = guessSpeaker('B', 800, players, [readyProfile('p1', 'Damian')]);
    assert.ok(guess.confidence < SPEAKER_AUTO_THRESHOLD);
    assert.equal(shouldAskWhoSaidThat(guess), true);
  });
});
