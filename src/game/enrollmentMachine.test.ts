import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PHRASES_REQUIRED,
  buildVoiceProfile,
  canMarkVoiceReady,
  classifySampleQuality,
  enrollmentPhrases,
  phrasePassed,
  scorePhraseMatch,
} from './enrollmentMachine';
import type { EnrollmentSample } from '../types';

function sample(
  phraseId: EnrollmentSample['phraseId'],
  transcript: string,
  score: number,
  extras: Partial<EnrollmentSample> = {},
): EnrollmentSample {
  return {
    phraseId,
    prompt: transcript,
    transcript,
    durationMs: 1800,
    audioUri: 'file:///tmp/sample.wav',
    matchScore: score,
    capturedAt: Date.now(),
    embedding: extras.embedding ?? [0.2, 0.1, 0.05],
    speechDetected: extras.speechDetected ?? true,
    ...extras,
  };
}

describe('enrollment machine', () => {
  it('requires real phrase matches — not any long sentence', () => {
    const ready = enrollmentPhrases('Damian')[0];
    assert.ok(ready);
    assert.ok(
      scorePhraseMatch('My name is Damian and I am ready to play Smarter Then AI', ready, 'Damian') >=
        0.55,
    );
    assert.ok(scorePhraseMatch('hello there everybody', ready, 'Damian') < 0.55);
    assert.equal(phrasePassed(scorePhraseMatch('ready', ready, 'Damian')), false);
  });

  it('treats yes/no as requiring the actual word in a longer line', () => {
    const yes = enrollmentPhrases('Delissa').find((phrase) => phrase.id === 'yes');
    const no = enrollmentPhrases('Delissa').find((phrase) => phrase.id === 'no');
    assert.ok(yes && no);
    assert.ok(
      scorePhraseMatch('Yes I know this one and I am sure of my answer', yes, 'Delissa') >= 0.55,
    );
    assert.equal(scorePhraseMatch('this is a long unrelated sentence', yes, 'Delissa'), 0);
    assert.ok(scorePhraseMatch('No that is not the answer I wanted to give', no, 'Delissa') >= 0.55);
    assert.equal(scorePhraseMatch('I know the answer', no, 'Delissa'), 0);
  });

  it('rejects silence and too-short samples', () => {
    assert.equal(
      classifySampleQuality({
        durationMs: 400,
        transcript: 'yes',
        matchScore: 1,
        speechDetected: true,
      }),
      'too-short',
    );
    assert.equal(
      classifySampleQuality({
        durationMs: 1800,
        transcript: '',
        matchScore: 1,
        speechDetected: false,
      }),
      'silence',
    );
  });

  it('does not mark voiceReady without enough passed samples', () => {
    const empty = buildVoiceProfile('p1', 'Damian', []);
    assert.equal(canMarkVoiceReady(empty), false);
    const two = buildVoiceProfile('p1', 'Damian', [
      sample('ready', 'My name is Damian and I am ready to play Smarter Then AI', 0.9),
      sample('yes', 'Yes I know this one and I am sure of my answer', 1),
    ]);
    assert.equal(two.quality.phrasesPassed, 2);
    assert.equal(canMarkVoiceReady(two), false);
    const three = buildVoiceProfile('p1', 'Damian', [
      sample('ready', 'My name is Damian and I am ready to play Smarter Then AI', 0.9),
      sample('yes', 'Yes I know this one and I am sure of my answer', 1),
      sample('no', 'No that is not the answer I wanted to give', 1),
    ]);
    assert.ok(three.quality.phrasesPassed >= PHRASES_REQUIRED);
    assert.equal(canMarkVoiceReady(three), true);
    assert.equal(three.offlineReady, true);
    assert.equal(three.enrollmentSamples[0]?.audioUri, null);
  });
});
