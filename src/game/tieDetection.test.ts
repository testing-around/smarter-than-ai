import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Player } from '../types';
import { detectLeaders, isPlayerInTiebreak, tieAnnouncement } from './tieDetection';
import { evaluateMatchEnd } from './winConditions';
import { hostCorrectLine, hostWrongReaction, resetPersonalityHistory } from './hostPersonality';
import { neverRandomWinner, pickWinnerLine } from './winnerEngine';

function p(id: string, name: string, score: number): Player {
  return { id, name, emoji: '⭐', score, enrolled: true };
}

describe('tie detection', () => {
  it('never picks a random winner when two share the lead', () => {
    const tied = [p('a', 'Damian', 400), p('b', 'Dorian', 400), p('c', 'Delissa', 200)];
    const detection = detectLeaders(tied);
    assert.equal(detection.isTie, true);
    assert.equal(detection.leaders.length, 2);
    assert.equal(neverRandomWinner(detection.leaders), null);
    assert.match(tieAnnouncement(detection.leaders, detection.score), /tie/);
  });

  it('names a unique leader', () => {
    const roster = [p('a', 'Damian', 500), p('b', 'Dorian', 200)];
    const detection = detectLeaders(roster);
    assert.equal(detection.isTie, false);
    assert.equal(detection.leaders[0]?.id, 'a');
    assert.equal(neverRandomWinner(detection.leaders)?.id, 'a');
  });

  it('limits tiebreak eligibility to leaders', () => {
    const leaders = [p('a', 'Damian', 300), p('b', 'Dorian', 300)];
    assert.equal(isPlayerInTiebreak('a', leaders), true);
    assert.equal(isPlayerInTiebreak('c', leaders), false);
  });
});

describe('win conditions', () => {
  it('ends on a unique point target', () => {
    const decision = evaluateMatchEnd({
      players: [p('a', 'Damian', 520), p('b', 'Dorian', 200)],
      winCondition: 'POINT_TARGET',
      pointTarget: 500,
      questionsPlayed: 3,
      questionLimit: 10,
      remainingCount: 7,
      inTiebreak: false,
    });
    assert.equal(decision.kind, 'winner');
    if (decision.kind === 'winner') {
      assert.equal(decision.winner.name, 'Damian');
    }
  });

  it('opens a tiebreak when the limit ends in a deadlock', () => {
    const decision = evaluateMatchEnd({
      players: [p('a', 'Damian', 300), p('b', 'Dorian', 300)],
      winCondition: 'QUESTION_LIMIT',
      pointTarget: 500,
      questionsPlayed: 10,
      questionLimit: 10,
      remainingCount: 0,
      inTiebreak: false,
    });
    assert.equal(decision.kind, 'tiebreak');
  });

  it('TIMER stub does not end before the question cap', () => {
    const decision = evaluateMatchEnd({
      players: [p('a', 'Damian', 900)],
      winCondition: 'TIMER',
      pointTarget: 500,
      questionsPlayed: 2,
      questionLimit: 10,
      remainingCount: 8,
      inTiebreak: false,
    });
    assert.equal(decision.kind, 'continue');
  });

  it('tiebreak continues until one leader is alone', () => {
    const still = evaluateMatchEnd({
      players: [p('a', 'Damian', 400), p('b', 'Dorian', 400)],
      winCondition: 'QUESTION_LIMIT',
      pointTarget: 500,
      questionsPlayed: 12,
      questionLimit: 10,
      remainingCount: 4,
      inTiebreak: true,
    });
    assert.equal(still.kind, 'tiebreak');
    const done = evaluateMatchEnd({
      players: [p('a', 'Damian', 520), p('b', 'Dorian', 400)],
      winCondition: 'QUESTION_LIMIT',
      pointTarget: 500,
      questionsPlayed: 13,
      questionLimit: 10,
      remainingCount: 3,
      inTiebreak: true,
    });
    assert.equal(done.kind, 'winner');
  });
});

describe('winner and host lines', () => {
  it('names the champion and uses THEN branding', () => {
    resetPersonalityHistory();
    const line = pickWinnerLine('Dorian');
    assert.match(line, /Dorian/);
    assert.equal(/than/i.test(line), false);
  });

  it('puts the player name on correct and wrong reactions', () => {
    resetPersonalityHistory();
    const ok = hostCorrectLine('FUNNY', 'Dorian', 'Mars');
    const no = hostWrongReaction('FUNNY', 'Dorian', 'Venus');
    assert.match(ok, /Dorian/);
    assert.match(no, /Dorian/);
  });
});
