import { CATEGORY_LABEL } from '../data/bank';
import type { Question } from '../types';
import { letters } from '../theme/colors';
import { hostCopy, hostSay, type HostSayRequest } from './tts';

/** Host question text for DISPLAY + TTS only. Never includes the correct answer. */
export function buildQuestionUtterance(
  question: Question,
  number: number,
  isBoss: boolean,
): string {
  const intro = isBoss
    ? hostCopy.boss
    : hostCopy.question(number, CATEGORY_LABEL[question.category]);
  const choices = question.choices
    .map((choice, index) => `${letters[index] ?? String(index + 1)}. ${choice}`)
    .join('. ');
  return `${intro} ${question.question} ${choices}`.replace(/\s+/g, ' ').trim();
}

export function questionContainsSecret(utterance: string, question: Question): boolean {
  const hay = utterance.toLowerCase();
  const secret = question.correct_answer.trim().toLowerCase();
  if (!secret) {
    return false;
  }
  return hay.includes(`correct answer ${secret}`) || hay.includes(`the answer is ${secret}`);
}

export async function speakQuestion(
  question: Question,
  number: number,
  isBoss: boolean,
  request: HostSayRequest,
): Promise<ReturnType<typeof hostSay>> {
  const line = buildQuestionUtterance(question, number, isBoss);
  const safe = questionContainsSecret(line, question)
    ? `${hostCopy.question(number, question.category)} ${question.question}`
    : line;
  return hostSay(safe, request);
}
