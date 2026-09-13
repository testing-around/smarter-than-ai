export type ScreenName =
  | 'HOME'
  | 'SETUP'
  | 'VOICE_CHECK'
  | 'LOBBY'
  | 'GAME'
  | 'ROUND_RESULT'
  | 'FINAL';

/** Legacy 8-bucket labels used by the first in-app bank. */
export type LegacyCategory =
  | 'science'
  | 'math'
  | 'geography'
  | 'history'
  | 'logic'
  | 'general'
  | 'pop'
  | 'kaiju';

/** 30 master categories — see docs/CATEGORIES.md */
export type MasterCategory =
  | 'Math'
  | 'Science'
  | 'Space'
  | 'Geography'
  | 'History'
  | 'English'
  | 'Logic'
  | 'Animals'
  | 'Dinosaurs'
  | 'Human Body'
  | 'Weather'
  | 'Earth Science'
  | 'Technology'
  | 'Artificial Intelligence'
  | 'Money & Finance'
  | 'Government & Civics'
  | 'Sports'
  | 'Food'
  | 'Music'
  | 'Games & Gaming'
  | 'Kaiju'
  | 'Coding'
  | 'Cybersecurity'
  | 'Caribbean'
  | 'New Jersey'
  | 'Literature'
  | 'Art'
  | 'Mythology'
  | 'Inventions'
  | 'Nature & Environment';

export type QuestionType =
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE'
  | 'RIDDLE'
  | 'SHORT_ANSWER'
  | 'BOSS';

export type DifficultyBand = 'easy' | 'medium' | 'hard';
export type GameDifficulty = 'easy' | 'adaptive' | 'hard';
export type AnswerMode = 'shout' | 'buzz' | 'turn';
export type QuestionCount = 5 | 10 | 20;
export type AnswerSource = 'tap' | 'voice' | 'buzz' | 'ai' | 'timeout' | 'claim';
export type HostVoiceMode = 'british-female' | 'system';

/** @deprecated Use DifficultyBand. Kept so older imports still typecheck during the swap. */
export type QuestionDifficulty = DifficultyBand;
/** @deprecated Use MasterCategory. */
export type Category = LegacyCategory;

export interface LegacyQuestion {
  id: string;
  category: LegacyCategory;
  difficulty: DifficultyBand;
  prompt: string;
  choices: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
}

export interface Question {
  question_id: string;
  category: MasterCategory;
  subcategory: string;
  difficulty: number;
  grade_min: number;
  grade_max: number;
  question_type: QuestionType;
  question: string;
  choices: string[];
  correct_answer: string;
  accepted_answers: string[];
  explanation: string;
  time_limit_seconds: number;
  base_points: number;
  speed_bonus: boolean;
  steal_allowed: boolean;
  source_verified: boolean;
  active: boolean;
  quality_score: number;
}

export interface Player {
  id: string;
  name: string;
  emoji: string;
  score: number;
  enrolled: boolean;
  isAi?: boolean;
}

export interface GameSettings {
  questionCount: QuestionCount;
  answerMode: AnswerMode;
  difficulty: GameDifficulty;
  timerSeconds: number;
  voiceEnabled: boolean;
  beatTheAi: boolean;
  hostVoice: HostVoiceMode;
}

export interface RoundResult {
  question: Question;
  playerId: string | null;
  playerName: string | null;
  choiceIndex: number | null;
  correct: boolean;
  points: number;
  responseMs: number;
  timedOut: boolean;
  source: AnswerSource;
  isBoss: boolean;
}

export interface LeaderboardRow {
  name: string;
  emoji: string;
  wins: number;
  lastScore: number;
}

export interface WhoSaidThat {
  transcript: string;
  choiceIndex: number;
}

export interface VoiceStatus {
  available: boolean;
  detail: string;
}

export type QuickModeId = 'family' | 'lightning' | 'beatAi' | 'grade';
