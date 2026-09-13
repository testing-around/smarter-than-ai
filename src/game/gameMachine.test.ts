import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isEarlyAnswerArmed, isEarlyShoutArmed, isEarlyTapArmed } from './earlyShout';
import {
  bannerFor,
  bannerHint,
  bannerLabel,
  canAcceptAnswers,
  canStartListening,
  listeningUnlocksOnTts,
  shouldAdvanceAfterJudgment,
} from './phases';
import { createQuestionSessionId, isLiveSession } from './session';

describe('game machine gates', () => {
  it('never accepts answers until listening phase', () => {
    assert.equal(canAcceptAnswers('HOST_SPEAKING'), false);
    assert.equal(canAcceptAnswers('QUESTION_DISPLAYED'), false);
    assert.equal(canAcceptAnswers('HOST_SPEECH_FINISHED'), false);
    assert.equal(canAcceptAnswers('LISTENING_FOR_PLAYERS'), true);
    assert.equal(canAcceptAnswers('WAITING_FOR_ANSWERS'), true);
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

  it('arms early shout-out only for shout-out mode', () => {
    assert.equal(isEarlyShoutArmed({ earlyShoutOut: true, answerMode: 'shout' }), true);
    assert.equal(isEarlyShoutArmed({ earlyShoutOut: true, answerMode: 'buzz' }), false);
    assert.equal(isEarlyShoutArmed({ earlyShoutOut: false, answerMode: 'shout' }), false);
  });

  it('accepts early interrupt while the host is still speaking', () => {
    assert.equal(canAcceptAnswers('HOST_SPEAKING', true), true);
    assert.equal(canAcceptAnswers('REPEATING_QUESTION', true), true);
    assert.equal(canAcceptAnswers('REPEATING_QUESTION', false), false);
    assert.equal(canStartListening('HOST_SPEAKING', true, true, true), true);
    assert.equal(canStartListening('HOST_SPEAKING', true, false, true), false);
    assert.equal(bannerFor('HOST_SPEAKING', null, { earlyTapIn: true }), 'asking-armed');
    assert.equal(bannerFor('REPEATING_QUESTION', null, { earlyTapIn: true }), 'asking-armed');
    assert.equal(bannerLabel('asking-armed'), '🔊 HOST READING…');
    assert.equal(bannerHint('asking-armed'), 'Tap an answer anytime');
  });

  it('arms tap-during-TTS for shout-out even when voice early shout is off', () => {
    assert.equal(isEarlyTapArmed({ earlyTapIn: true, earlyShoutOut: false, answerMode: 'shout' }), true);
    assert.equal(isEarlyTapArmed({ earlyTapIn: undefined, earlyShoutOut: false, answerMode: 'shout' }), true);
    assert.equal(isEarlyTapArmed({ earlyTapIn: false, earlyShoutOut: false, answerMode: 'shout' }), false);
    assert.equal(isEarlyTapArmed({ earlyTapIn: true, earlyShoutOut: false, answerMode: 'turn' }), false);
    assert.equal(isEarlyAnswerArmed({ earlyTapIn: false, earlyShoutOut: true, answerMode: 'shout' }), true);
    assert.equal(isEarlyShoutArmed({ earlyShoutOut: false, answerMode: 'shout' }), false);
  });

  it('shows the who-said-that interrupt alert after an early shout', () => {
    assert.equal(
      bannerFor('ANSWER_DETECTED', null, { earlyShoutOut: true, interrupt: true }),
      'interrupt',
    );
    assert.equal(
      bannerFor('SPEAKER_IDENTIFICATION', null, { earlyShoutOut: true, interrupt: true }),
      'interrupt',
    );
    assert.equal(bannerLabel('interrupt'), '⚡ ANSWER HEARD!');
  });

  it('completes only on a correct answer or host skip/reveal', () => {
    assert.equal(shouldAdvanceAfterJudgment(true, 'voice'), true);
    assert.equal(shouldAdvanceAfterJudgment(false, 'voice'), false);
    assert.equal(shouldAdvanceAfterJudgment(false, 'timeout'), false);
    assert.equal(shouldAdvanceAfterJudgment(false, 'skip'), true);
    assert.equal(shouldAdvanceAfterJudgment(false, 'host'), true);
    assert.equal(bannerFor('WRONG_ATTEMPT'), 'wrong');
    assert.equal(bannerFor('WAITING_FOR_ANSWERS'), 'listening');
    assert.equal(bannerFor('QUESTION_COMPLETE', true), 'correct');
  });
});
