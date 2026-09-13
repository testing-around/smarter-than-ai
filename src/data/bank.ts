import seed from '../../data/master-seed-questions.json';
import type { MasterCategory, Question, QuestionType } from '../types';
import { GAP_QUESTIONS } from './gapQuestions';
import { convertLegacyQuestion } from './legacyConvert';
import { MORE_QUESTIONS } from './moreQuestions';
import { CORE_QUESTIONS } from './questions';
import { dedupeKey, isPlayable } from './questionAccess';

const MASTER_CATEGORIES = new Set<string>([
  'Math',
  'Science',
  'Space',
  'Geography',
  'History',
  'English',
  'Logic',
  'Animals',
  'Dinosaurs',
  'Human Body',
  'Weather',
  'Earth Science',
  'Technology',
  'Artificial Intelligence',
  'Money & Finance',
  'Government & Civics',
  'Sports',
  'Food',
  'Music',
  'Games & Gaming',
  'Kaiju',
  'Coding',
  'Cybersecurity',
  'Caribbean',
  'New Jersey',
  'Literature',
  'Art',
  'Mythology',
  'Inventions',
  'Nature & Environment',
]);

const QUESTION_TYPES = new Set<QuestionType>([
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'RIDDLE',
  'SHORT_ANSWER',
  'BOSS',
]);

function asMasterCategory(value: string): MasterCategory {
  if (MASTER_CATEGORIES.has(value)) {
    return value as MasterCategory;
  }
  return 'Science';
}

function asQuestionType(value: string): QuestionType {
  if (QUESTION_TYPES.has(value as QuestionType)) {
    return value as QuestionType;
  }
  return 'MULTIPLE_CHOICE';
}

function fromSeed(raw: (typeof seed)[number]): Question {
  return {
    question_id: raw.question_id,
    category: asMasterCategory(raw.category),
    subcategory: raw.subcategory,
    difficulty: raw.difficulty,
    grade_min: raw.grade_min,
    grade_max: raw.grade_max,
    question_type: asQuestionType(raw.question_type),
    question: raw.question,
    choices: [...raw.choices],
    correct_answer: raw.correct_answer,
    accepted_answers: [...raw.accepted_answers],
    explanation: raw.explanation,
    time_limit_seconds: raw.time_limit_seconds,
    base_points: raw.base_points,
    speed_bonus: raw.speed_bonus,
    steal_allowed: raw.steal_allowed,
    source_verified: raw.source_verified,
    active: raw.active,
    quality_score: raw.quality_score,
  };
}

function mergeUnique(batches: Question[][]): Question[] {
  const seen = new Set<string>();
  const out: Question[] = [];
  for (const batch of batches) {
    for (const item of batch) {
      if (!isPlayable(item)) {
        continue;
      }
      const key = dedupeKey(item.question, item.correct_answer);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

const legacy = [...CORE_QUESTIONS, ...MORE_QUESTIONS].map(convertLegacyQuestion);

export const QUESTIONS: Question[] = mergeUnique([
  seed.map(fromSeed),
  legacy,
  GAP_QUESTIONS,
]);

export const CATEGORY_LABEL: Record<MasterCategory, string> = {
  Math: 'Math',
  Science: 'Science',
  Space: 'Space',
  Geography: 'Geography',
  History: 'History',
  English: 'English',
  Logic: 'Logic',
  Animals: 'Animals',
  Dinosaurs: 'Dinosaurs',
  'Human Body': 'Human Body',
  Weather: 'Weather',
  'Earth Science': 'Earth Science',
  Technology: 'Technology',
  'Artificial Intelligence': 'AI',
  'Money & Finance': 'Money',
  'Government & Civics': 'Civics',
  Sports: 'Sports',
  Food: 'Food',
  Music: 'Music',
  'Games & Gaming': 'Games',
  Kaiju: 'Kaiju',
  Coding: 'Coding',
  Cybersecurity: 'Security',
  Caribbean: 'Caribbean',
  'New Jersey': 'New Jersey',
  Literature: 'Literature',
  Art: 'Art',
  Mythology: 'Mythology',
  Inventions: 'Inventions',
  'Nature & Environment': 'Nature',
};

export function playableQuestionCount(): number {
  return QUESTIONS.length;
}
