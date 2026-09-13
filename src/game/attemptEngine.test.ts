import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Player, Question } from '../types';
import {
  createAttempt,
  decideAttemptOutcome,
  hostLineRevealsAnswer,
  hostWrongLine,
  isPlayerLockedOut,
  lockoutsAfterWrong,
  nextAttemptNumber,
  questionHasWinner,
  resetLockouts,
  shouldRevealCorrectAnswer,
} from './attemptEngine';

const question: Question = {
  question_id: 'q-water',
  category: 'Science',
  subcategory: 'cycle',
  difficulty: 3,
  grade_min: 3,
  grade_max: 8,
  question_type: 'MULTIPLE_CHOICE',
  question: 'Water turning into vapor is called?',
  choices: ['Evaporation', 'Condensation', 'Freezing', 'Melting'],
  correct_answer: 'Condensation',
  accepted_answers: ['condensation'],
  explanation: 'Gas to liquid is condensation.',
  time_limit_seconds: 15,
  base_points: 100,
  speed_bonus: true,
  steal_allowed: false,
  source_verified: true,
  active: true,
  quality_score: 1,
};

const daniel: Player = { id: 'daniel', name: 'Daniel', emoji: '🧠', score: 0, enrolled: true };
const dorian: Player = { id: 'dorian', name: 'Dorian', emoji: '🦖', score: 0, enrolled: true };

describe('attempt engine', () => {
  it('keeps a wrong attempt live and never reveals the correct answer', () => {
    const outcome = decideAttemptOutcome({
      player: daniel,
      source: 'voice',
      timedOut: false,
      correct: false,
    });
    assert.equal(outcome.action, 'stay_live');
    assert.equal(outcome.reason, 'wrong');
    assert.equal(shouldRevealCorrectAnswer(false), false);

    const attempt = createAttempt({
      question,
      player: daniel,
      choiceIndex: 0,
      isCorrect: false,
      responseTimeMs: 1200,
      inputSource: 'voice',
      priorAttempts: [],
    });
    assert.equal(attempt.playerName, 'Daniel');
    assert.equal(attempt.answer, 'Evaporation');
    assert.equal(attempt.isCorrect, false);
    assert.equal(attempt.attemptNumber, 1);
    assert.equal(questionHasWinner([attempt]), false);

    const line = hostWrongLine(attempt.playerName);
    assert.equal(line, 'Not this time, Daniel.');
    assert.equal(hostLineRevealsAnswer(line, question), false);
  });

  it('completes only after a correctly attributed answer', () => {
    const wrong = createAttempt({
      question,
      player: daniel,
      choiceIndex: 0,
      isCorrect: false,
      responseTimeMs: 900,
      inputSource: 'clicker',
      priorAttempts: [],
    });
    const correct = createAttempt({
      question,
      player: dorian,
      choiceIndex: 1,
      isCorrect: true,
      responseTimeMs: 1400,
      inputSource: 'voice',
      priorAttempts: [wrong],
    });
    assert.equal(correct.attemptNumber, 2);
    assert.equal(correct.answer, 'Condensation');
    assert.equal(questionHasWinner([wrong, correct]), true);
    assert.equal(
      decideAttemptOutcome({
        player: dorian,
        source: 'voice',
        timedOut: false,
        correct: true,
      }).action,
      'complete',
    );
    assert.equal(shouldRevealCorrectAnswer(true), true);
  });

  it('locks a wrong player for the rest of this question', () => {
    const locked = lockoutsAfterWrong([], daniel.id, true);
    assert.equal(isPlayerLockedOut(locked, 'daniel', true), true);
    assert.equal(isPlayerLockedOut(locked, 'dorian', true), false);
    assert.equal(isPlayerLockedOut(locked, 'daniel', false), false);
    assert.deepEqual(resetLockouts(), []);
  });

  it('refuses to grade an unattributed answer and does not complete on timeout', () => {
    assert.deepEqual(
      decideAttemptOutcome({
        player: null,
        source: 'voice',
        timedOut: false,
        correct: false,
      }),
      { action: 'reject_unattributed', reason: 'missing_player' },
    );
    assert.deepEqual(
      decideAttemptOutcome({
        player: null,
        source: 'timeout',
        timedOut: true,
        correct: false,
      }),
      { action: 'stay_live', reason: 'timeout' },
    );
    assert.equal(decideAttemptOutcome({
      player: null,
      source: 'skip',
      timedOut: true,
      correct: false,
    }).action, 'complete');
    assert.equal(nextAttemptNumber([], question.question_id), 1);
  });

  it('throws if an attempt has no identified player', () => {
    assert.throws(() =>
      createAttempt({
        question,
        player: { id: '', name: 'Someone', emoji: '?', score: 0, enrolled: false },
        choiceIndex: 1,
        isCorrect: true,
        responseTimeMs: 10,
        inputSource: 'voice',
        priorAttempts: [],
      }),
    );
  });
});
