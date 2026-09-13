import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_SETTINGS } from '../services/storage';
import { MemoryStore, createGameSessionStore } from '../services/gameSessionStore';
import type { Player, QuestionAttempt } from '../types';
import {
  createGameSession,
  isResumable,
  remainingIdsFromDeck,
  restoreQuestionOrder,
} from './gameSession';

const players: Player[] = [
  { id: 'daniel', name: 'Daniel', emoji: '🧠', score: 0, enrolled: true },
  { id: 'dorian', name: 'Dorian', emoji: '🦖', score: 40, enrolled: true },
];

describe('game session save/resume', () => {
  it('restores the same mid-wrong-loop question, attempts, and lockouts', async () => {
    const store = createGameSessionStore(new MemoryStore());
    const order = ['q-water', 'q-mars', 'q-rome'];
    const session = createGameSession({
      settings: { ...DEFAULT_SETTINGS, questionCount: 10 },
      players,
      questionOrder: order,
      remainingQuestionIds: ['q-mars', 'q-rome'],
      currentQuestionId: 'q-water',
      questionNumber: 1,
    });
    const attempt: QuestionAttempt = {
      questionId: 'q-water',
      playerId: 'daniel',
      playerName: 'Daniel',
      answer: 'Evaporation',
      answerChoice: 0,
      isCorrect: false,
      timestamp: 1,
      responseTimeMs: 800,
      inputSource: 'voice',
      speakerConfidence: 0.8,
      attemptNumber: 1,
    };
    const saved = await store.saveSession({
      ...session,
      questionAttempts: [attempt],
      lockoutPlayerIds: ['daniel'],
      questionState: 'WAITING_FOR_ANSWERS',
      remainingTimeMs: 12000,
      players: players.map((p) => ({ ...p })),
    });

    const loaded = await store.loadSession(saved.id);
    assert.ok(loaded);
    assert.equal(loaded?.currentQuestionId, 'q-water');
    assert.equal(loaded?.questionNumber, 1);
    assert.equal(loaded?.questionAttempts[0]?.answer, 'Evaporation');
    assert.deepEqual(loaded?.lockoutPlayerIds, ['daniel']);
    assert.deepEqual(loaded?.remainingQuestionIds, ['q-mars', 'q-rome']);
    assert.deepEqual(loaded?.questionOrder, order);
    assert.equal(isResumable(loaded), true);
    assert.equal(loaded?.players.find((p) => p.id === 'dorian')?.score, 40);
  });

  it('does not reshuffle remaining questions on resume', () => {
    const byId = (id: string) =>
      ({
        question_id: id,
        category: 'Science',
        subcategory: '',
        difficulty: 3,
        grade_min: 1,
        grade_max: 8,
        question_type: 'MULTIPLE_CHOICE',
        question: id,
        choices: ['A', 'B', 'C', 'D'],
        correct_answer: 'A',
        accepted_answers: ['a'],
        explanation: '',
        time_limit_seconds: 15,
        base_points: 100,
        speed_bonus: true,
        steal_allowed: false,
        source_verified: true,
        active: true,
        quality_score: 1,
      }) as const;
    const restored = restoreQuestionOrder(
      ['q1', 'q2', 'q3'],
      ['q2', 'q3'],
      (id) => byId(id),
    );
    assert.deepEqual(
      restored.remaining.map((q) => q.question_id),
      ['q2', 'q3'],
    );
    assert.equal(restored.orderValid, true);
    assert.deepEqual(remainingIdsFromDeck(['q1', 'q2', 'q3'], 'q1'), ['q2', 'q3']);
  });
});
