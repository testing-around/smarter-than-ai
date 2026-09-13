import type { LegacyCategory, LegacyQuestion, MasterCategory, Question } from '../types';
import { bandToDifficulty } from './questionAccess';

const CATEGORY_MAP: Record<LegacyCategory, MasterCategory> = {
  science: 'Science',
  math: 'Math',
  geography: 'Geography',
  history: 'History',
  logic: 'Logic',
  general: 'Literature',
  pop: 'Games & Gaming',
  kaiju: 'Kaiju',
};

const ID_CATEGORY: Partial<Record<string, MasterCategory>> = {
  'sci-03': 'Space',
  'sci-06': 'Space',
  'sci-21': 'Space',
  'sci-23': 'Space',
  'sci-04': 'Human Body',
  'sci-08': 'Human Body',
  'sci-15': 'Human Body',
  'sci-18': 'Human Body',
  'sci-20': 'Human Body',
  'sci-11': 'Nature & Environment',
  'sci-12': 'Human Body',
  'sci-13': 'Animals',
  'sci-22': 'Earth Science',
  'gen-01': 'Nature & Environment',
  'gen-02': 'Literature',
  'gen-03': 'Space',
  'gen-04': 'Sports',
  'gen-05': 'History',
  'gen-06': 'Music',
  'gen-07': 'Space',
  'gen-08': 'Literature',
  'gen-09': 'Art',
  'gen-10': 'Art',
  'gen-11': 'Math',
  'gen-12': 'Science',
  'gen-13': 'Geography',
  'gen-14': 'Science',
  'gen-15': 'Animals',
  'gen-16': 'Music',
  'gen-17': 'Inventions',
  'gen-18': 'Money & Finance',
  'gen-19': 'Animals',
  'gen-20': 'English',
  'gen-21': 'Math',
  'gen-22': 'Animals',
  'gen-23': 'Nature & Environment',
  'pop-06': 'Literature',
  'pop-14': 'Music',
  'log-07': 'Music',
};

export function convertLegacyQuestion(item: LegacyQuestion): Question {
  const correct = item.choices[item.correctIndex] ?? item.choices[0] ?? '';
  const category = ID_CATEGORY[item.id] ?? CATEGORY_MAP[item.category];
  const level = bandToDifficulty(item.difficulty);
  return {
    question_id: `LEGACY-${item.id.toUpperCase()}`,
    category,
    subcategory: item.category,
    difficulty: level,
    grade_min: item.difficulty === 'easy' ? 1 : item.difficulty === 'medium' ? 3 : 5,
    grade_max: item.difficulty === 'easy' ? 5 : item.difficulty === 'medium' ? 8 : 12,
    question_type: item.category === 'logic' && /riddle|what has|why/i.test(item.prompt)
      ? 'RIDDLE'
      : 'MULTIPLE_CHOICE',
    question: item.prompt,
    choices: [...item.choices],
    correct_answer: correct,
    accepted_answers: [correct],
    explanation: item.explanation,
    time_limit_seconds: 15,
    base_points: 100,
    speed_bonus: true,
    steal_allowed: true,
    source_verified: false,
    active: true,
    quality_score: 0.82,
  };
}
