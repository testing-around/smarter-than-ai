import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bannerFor,
  bannerLabel,
  canAcceptAnswers,
  canStartListening,
  listeningUnlocksOnTts,
} from './phases';
import { createQuestionSessionId, isLiveSession } from './session';

describe('game machine gates', () => {
  it('never accepts answers until listening phase', () => {
    assert.equal(canAcceptAnswers('HOST_SPEAKING'), false);
    assert.equal(canAcceptAnswers('QUESTION_DISPLAYED'), false);
    assert.equal(canAcceptAnswers('HOST_SPEECH_FINISHED'), false);
    assert.equal(canAcceptAnswers('LISTENING_FOR_PLAYERS'), true);
    assert.equal(canAcceptAnswers('ANSWER_DETECTED'), false);
  });

  it('opens the mic only after TTS-gated listening is enabled', () => {
    assert.equal(canStartListening('HOST_SPEAKING', true, true), false);
    assert.equal(canStartListening('LISTENING_FOR_PLAYERS', true, true), false);
    assert.equal(canStartListening('LISTENING_FOR_PLAYERS', false, false), false);
    assert.equal(canStartListening('LISTENING_FOR_PLAYERS', false, true), true);
  });

  it('unlocks listening only on real onDone, not timers or errors', () => {
    assert.equal(listeningUnlocksOnTts('done'), true);
    assert.equal(listeningUnlocksOnTts('stopped'), false);
    assert.equal(listeningUnlocksOnTts('error'), false);
    assert.equal(listeningUnlocksOnTts('unavailable'), false);
    assert.equal(listeningUnlocksOnTts('stale'), false);
  });

  it('ignores stale session callbacks', () => {
    const live = createQuestionSessionId('q-1');
    const prior = createQuestionSessionId('q-1');
    assert.equal(isLiveSession(live, live), true);
    assert.equal(isLiveSession(prior, live), false);
    assert.equal(isLiveSession('', live), false);
  });

  it('maps phases to host banners', () => {
    assert.equal(bannerFor('HOST_SPEAKING'), 'asking');
    assert.equal(bannerLabel('asking'), '🔊 AI IS ASKING…');
    assert.equal(bannerLabel(bannerFor('LISTENING_FOR_PLAYERS')), '🎤 LISTENING…');
    assert.equal(bannerLabel(bannerFor('ANSWER_JUDGING')), '🧠 CHECKING…');
    assert.equal(bannerLabel(bannerFor('HOST_FEEDBACK', true)), '✅ CORRECT');
    assert.equal(bannerLabel(bannerFor('HOST_FEEDBACK', false)), '❌ WRONG');
  });
});
