export type ScreenName =
  | 'HOME'
  | 'SETUP'
  | 'VOICE_CHECK'
  | 'LOBBY'
  | 'GAME'
  | 'ROUND_RESULT'
  | 'FINAL';

export type Category =
  | 'science'
  | 'math'
  | 'geography'
  | 'logic'
  | 'general'
  | 'kaiju';

export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type GameDifficulty = 'easy' | 'adaptive' | 'hard';
export type AnswerMode = 'shout' | 'buzz' | 'turn';
export type QuestionCount = 5 | 10 | 20;
export type AnswerSource = 'tap' | 'voice' | 'buzz' | 'ai' | 'timeout' | 'claim';

export interface Question {
  id: string;
  category: Category;
  difficulty: QuestionDifficulty;
  prompt: string;
  choices: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
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
