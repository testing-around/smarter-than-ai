import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Player, Question } from '../types';
import {
  detectOverlap,
  evaluateTranscript,
  isContestantInterrupt,
  judgeChoice,
  looksLikeHostEcho,
  whoSaidPrompt,
} from './answerJudgeEngine';
import { parseSpokenAnswer } from './speechParser';

const question: Question = {
  question_id: 'q-mars',
  category: 'Space',
  subcategory: 'planets',
  difficulty: 3,
  grade_min: 3,
  grade_max: 8,
  question_type: 'MULTIPLE_CHOICE',
  question: 'Which planet is known as the Red Planet?',
  choices: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
  correct_answer: 'Mars',
  accepted_answers: ['mars', 'the red planet'],
  explanation: 'Mars looks red.',
  time_limit_seconds: 15,
  base_points: 100,
  speed_bonus: true,
  steal_allowed: false,
  source_verified: true,
  active: true,
  quality_score: 1,
};

const players: Player[] = [
  { id: 'p1', name: 'Damian', emoji: '🧠', score: 0, enrolled: true },
  { id: 'p2', name: 'Dorian', emoji: '🦖', score: 0, enrolled: true },
];

describe('answer judge', () => {
  it('rejects host question echo as a contestant answer', () => {
    assert.equal(
      looksLikeHostEcho('Question 1. Space. Which planet is known as the Red Planet? A. Venus', question),
      true,
    );
    assert.equal(evaluateTranscript('Which planet is known as the Red Planet?', players, question, 100), null);
  });

  it('fuzzy-matches accepted answers and letters', () => {
    const named = parseSpokenAnswer('Damian, Mars', players, question.choices, question.accepted_answers);
    assert.equal(named.playerId, 'p1');
    assert.equal(named.choiceIndex, 1);
    assert.equal(judgeChoice(question, named.choiceIndex), true);

    const letter = parseSpokenAnswer('B', players, question.choices, question.accepted_answers);
    assert.equal(letter.choiceIndex, 1);
    assert.equal(letter.playerId, null);

    const typo = parseSpokenAnswer('marz', players, question.choices, question.accepted_answers);
    assert.equal(typo.choiceIndex, 1);
  });

  it('never drops an unknown speaker — pending + who said prompt', () => {
    const pending = evaluateTranscript('Mars', players, question, 400);
    assert.ok(pending);
    assert.equal(pending?.suggestedPlayerId, null);
    assert.equal(pending?.choiceIndex, 1);
    assert.equal(whoSaidPrompt(pending?.transcript ?? '', 'Mars'), 'Who said Mars?');
  });

  it('flags overlapping speaker names for host pick', () => {
    assert.equal(detectOverlap('Damian and Dorian both yelled Mars', players), 'MULTIPLE_SPEAKERS');
    assert.equal(detectOverlap('Damian Mars', players), 'SINGLE');
  });

  it('scores wrong answers as incorrect', () => {
    const pending = evaluateTranscript('Damian, Venus', players, question, 200);
    assert.equal(pending?.suggestedPlayerId, 'p1');
    assert.equal(pending?.suggestedCorrect, false);
    assert.equal(judgeChoice(question, 0), false);
  });

  it('rejects host TTS echo as an early contestant interrupt', () => {
    assert.equal(
      isContestantInterrupt(
        'Question 1. Space. Which planet is known as the Red Planet? A. Venus B. Mars',
        question,
        players,
      ),
      false,
    );
    assert.equal(
      isContestantInterrupt('Which planet is known as the Red Planet?', question, players),
      false,
    );
  });

  it('accepts a short isolated shout or a name-plus-answer during host speech', () => {
    assert.equal(isContestantInterrupt('Mars', question, players), true);
    assert.equal(isContestantInterrupt('Damian B', question, players), true);
    assert.equal(isContestantInterrupt('Damian, Venus', question, players), true);
  });

  it('rejects a host-like read that names two choices at once', () => {
    assert.equal(isContestantInterrupt('Venus Mars Jupiter Saturn', question, players), false);
    assert.equal(isContestantInterrupt('Option A Venus', question, players), false);
  });
});
