import { correctChoiceIndex, normalizeAnswer } from '../data/questionAccess';
import type { OverlapFlag, PendingAnswer, Player, Question } from '../types';
import { parseSpokenAnswer } from './speechParser';

export interface JudgeResult {
  choiceIndex: number | null;
  correct: boolean;
  playerId: string | null;
  overlap: OverlapFlag;
}

const HOST_PREFIX =
  /\b(question \d+|boss round|triple points|option [a-d]|letter [a-d])\b/i;

export function looksLikeHostEcho(transcript: string, question: Question): boolean {
  const hay = normalizeAnswer(transcript);
  if (!hay) {
    return false;
  }
  const prompt = normalizeAnswer(question.question);
  if (prompt.length >= 16) {
    const head = prompt.slice(0, Math.min(36, prompt.length));
    if (hay.includes(head)) {
      return true;
    }
  }
  if (HOST_PREFIX.test(transcript) && hay.length > prompt.length * 0.6) {
    return true;
  }
  return false;
}

export function detectOverlap(transcript: string, players: Player[]): OverlapFlag {
  const hay = normalizeAnswer(transcript);
  const hits = players.filter((player) => {
    if (player.isAi) {
      return false;
    }
    const name = normalizeAnswer(player.name);
    return name.length >= 3 && hay.includes(name);
  });
  return hits.length >= 2 ? 'MULTIPLE_SPEAKERS' : 'SINGLE';
}

export function judgeChoice(question: Question, choiceIndex: number | null): boolean {
  if (choiceIndex === null) {
    return false;
  }
  return choiceIndex === correctChoiceIndex(question);
}

/** During HOST_SPEAKING, ignore host-read echoes; allow short isolated answers or name+answer. */
export function isContestantInterrupt(
  transcript: string,
  question: Question,
  players: Player[],
): boolean {
  if (looksLikeHostEcho(transcript, question)) {
    return false;
  }
  const pending = evaluateTranscript(transcript, players, question, 0);
  if (!pending) {
    return false;
  }
  const hay = normalizeAnswer(transcript);
  const words = hay.split(' ').filter(Boolean);
  const choiceHits = question.choices.filter((choice) => hay.includes(normalizeAnswer(choice))).length;
  if (choiceHits >= 2) {
    return false;
  }
  if (pending.suggestedPlayerId) {
    return true;
  }
  if (HOST_PREFIX.test(transcript)) {
    return false;
  }
  return words.length <= 6;
}

export function evaluateTranscript(
  transcript: string,
  players: Player[],
  question: Question,
  responseMs: number,
): PendingAnswer | null {
  if (looksLikeHostEcho(transcript, question)) {
    return null;
  }

  const parsed = parseSpokenAnswer(
    transcript,
    players,
    question.choices,
    question.accepted_answers,
  );
  if (parsed.choiceIndex === null) {
    return null;
  }

  return {
    transcript,
    choiceIndex: parsed.choiceIndex,
    suggestedPlayerId: parsed.playerId,
    suggestedCorrect: judgeChoice(question, parsed.choiceIndex),
    responseMs,
    overlap: detectOverlap(transcript, players),
  };
}

export function whoSaidPrompt(transcript: string, choiceLabel: string): string {
  const heard = choiceLabel.trim() || transcript.trim();
  if (!heard) {
    return 'Who said that?';
  }
  const short = heard.length > 40 ? `${heard.slice(0, 37)}…` : heard;
  return `Who said ${short}?`;
}
