import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PHRASES_REQUIRED,
  buildVoiceProfile,
  canMarkVoiceReady,
  enrollmentPhrases,
  phrasePassed,
  scorePhraseMatch,
} from './enrollmentMachine';
import type { EnrollmentSample } from '../types';

function sample(
  phraseId: EnrollmentSample['phraseId'],
  transcript: string,
  score: number,
): EnrollmentSample {
  return {
    phraseId,
    prompt: transcript,
    transcript,
    durationMs: 900,
    audioUri: 'file:///tmp/sample.wav',
    matchScore: score,
    capturedAt: Date.now(),
  };
}

describe('enrollment machine', () => {
  it('requires real phrase matches — not any long sentence', () => {
    const ready = enrollmentPhrases('Damian')[0];
    assert.ok(ready);
    assert.ok(scorePhraseMatch('My name is Damian and I am ready to play', ready, 'Damian') >= 0.55);
    assert.ok(scorePhraseMatch('hello there everybody', ready, 'Damian') < 0.55);
    assert.equal(phrasePassed(scorePhraseMatch('ready', ready, 'Damian')), false);
  });

  it('treats yes/no strictly', () => {
    const yes = enrollmentPhrases('Delissa').find((phrase) => phrase.id === 'yes');
    const no = enrollmentPhrases('Delissa').find((phrase) => phrase.id === 'no');
    assert.ok(yes && no);
    assert.equal(scorePhraseMatch('Yes', yes, 'Delissa'), 1);
    assert.equal(scorePhraseMatch('this is a long unrelated sentence', yes, 'Delissa'), 0);
    assert.equal(scorePhraseMatch('No', no, 'Delissa'), 1);
    assert.equal(scorePhraseMatch('I know the answer', no, 'Delissa'), 0);
  });

  it('does not mark voiceReady without enough passed samples', () => {
    const empty = buildVoiceProfile('p1', 'Damian', []);
    assert.equal(canMarkVoiceReady(empty), false);
    const two = buildVoiceProfile('p1', 'Damian', [
      sample('ready', 'My name is Damian and I am ready to play', 0.9),
      sample('yes', 'Yes', 1),
    ]);
    assert.equal(two.quality.phrasesPassed, 2);
    assert.equal(canMarkVoiceReady(two), false);
    const three = buildVoiceProfile('p1', 'Damian', [
      sample('ready', 'My name is Damian and I am ready to play', 0.9),
      sample('yes', 'Yes', 1),
      sample('no', 'No', 1),
    ]);
    assert.ok(three.quality.phrasesPassed >= PHRASES_REQUIRED);
    assert.equal(canMarkVoiceReady(three), true);
    assert.equal(three.quality.hasAudio, true);
  });
});
