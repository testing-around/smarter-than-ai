import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Question } from '../types';
import { buildQuestionUtterance, questionContainsSecret } from './hostQuestionEngine';

const question: Question = {
  question_id: 'q-secret',
  category: 'Science',
  subcategory: 'atoms',
  difficulty: 5,
  grade_min: 5,
  grade_max: 9,
  question_type: 'MULTIPLE_CHOICE',
  question: 'What is H2O?',
  choices: ['Oxygen', 'Water', 'Helium', 'Salt'],
  correct_answer: 'Water',
  accepted_answers: ['water', 'h2o'],
  explanation: 'Water.',
  time_limit_seconds: 15,
  base_points: 100,
  speed_bonus: true,
  steal_allowed: false,
  source_verified: true,
  active: true,
  quality_score: 1,
};

describe('host question engine', () => {
  it('reads the question and choices but does not announce the secret answer', () => {
    const line = buildQuestionUtterance(question, 2, false);
    assert.match(line, /What is H2O/);
    assert.match(line, /Question 2/);
    assert.match(line, /Water/);
    assert.equal(questionContainsSecret(line, question), false);
    assert.equal(questionContainsSecret(`The answer is Water`, question), true);
  });
});
