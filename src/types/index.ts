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
export type AnswerSource =
  | 'tap'
  | 'voice'
  | 'buzz'
  | 'ai'
  | 'timeout'
  | 'claim'
  | 'clicker'
  | 'host'
  | 'skip';
export type HostVoiceMode = 'british-female' | 'system';
export type HostMode =
  | 'FULL_AI_HOST'
  | 'AI_HOST_PLUS_HUMAN_CLICKER'
  | 'HUMAN_HOST_PLUS_AI_ASSIST';
export type TtsOutcome = 'done' | 'stopped' | 'error' | 'empty' | 'disabled' | 'unavailable' | 'stale';
export type OverlapFlag = 'SINGLE' | 'MULTIPLE_SPEAKERS';

export type RoundPhase =
  | 'IDLE'
  | 'QUESTION_SELECTED'
  | 'QUESTION_DISPLAYED'
  | 'HOST_SPEAKING'
  | 'HOST_SPEECH_FINISHED'
  | 'LISTENING_FOR_PLAYERS'
  | 'ANSWER_DETECTED'
  | 'SPEAKER_IDENTIFICATION'
  | 'ANSWER_TRANSCRIPTION'
  | 'ANSWER_JUDGING'
  | 'SCORE_UPDATE'
  | 'HOST_FEEDBACK'
  | 'HOST_FEEDBACK_TTS_COMPLETE'
  | 'PAUSED'
  | 'TTS_ERROR'
  | 'HOST_STOPPED';

export type PhaseBannerId =
  | 'asking'
  | 'listening'
  | 'checking'
  | 'correct'
  | 'wrong'
  | 'paused'
  | 'error';

export type GameEventType =
  | 'QUESTION_LOADED'
  | 'DISPLAYED'
  | 'TTS_STARTED'
  | 'TTS_FINISHED'
  | 'TTS_ERROR'
  | 'TTS_STOPPED'
  | 'MIC_OPENED'
  | 'MIC_CLOSED'
  | 'SPEECH_PARTIAL'
  | 'SPEECH_FINAL'
  | 'TRANSCRIPT'
  | 'SPEAKER_GUESSED'
  | 'SPEAKER_IDENTIFIED'
  | 'SPEAKER_UNKNOWN'
  | 'SPEAKER_CORRECTED'
  | 'ANSWER_JUDGED'
  | 'JUDGMENT_OVERRIDE'
  | 'SCORE_UPDATED'
  | 'HOST_RESPONSE_STARTED'
  | 'HOST_RESPONSE_FINISHED'
  | 'NEXT_QUESTION'
  | 'REPEAT_QUESTION'
  | 'SKIP_QUESTION'
  | 'PAUSED'
  | 'RESUMED'
  | 'TRANSCRIPT_CORRECTED';

export interface GameEvent {
  at: number;
  sessionId: string;
  questionId: string | null;
  type: GameEventType;
  detail?: string;
}

export interface PendingAnswer {
  transcript: string;
  choiceIndex: number;
  suggestedPlayerId: string | null;
  suggestedCorrect: boolean;
  responseMs: number;
  overlap: OverlapFlag;
  speakerGuess?: string | null;
  speakerConfidence?: number;
}

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

export type EnrollmentPhraseId = 'ready' | 'yes' | 'no' | 'know' | 'name';

export interface EnrollmentSample {
  phraseId: EnrollmentPhraseId;
  prompt: string;
  transcript: string;
  durationMs: number;
  audioUri: string | null;
  matchScore: number;
  capturedAt: number;
}

export interface VoiceProfileQuality {
  phrasesPassed: number;
  phrasesRequired: number;
  hasAudio: boolean;
  voiceReady: boolean;
}

export interface VoiceProfile {
  playerId: string;
  name: string;
  enrollmentSamples: EnrollmentSample[];
  enrolledAt: number;
  quality: VoiceProfileQuality;
  meanDurationMs: number;
  meanSpeechRate: number;
}

export interface SpeakerGuess {
  playerId: string | null;
  confidence: number;
  method: 'name' | 'profile' | 'combined' | 'none';
}

export interface Player {
  id: string;
  name: string;
  emoji: string;
  score: number;
  enrolled: boolean;
  voiceReady?: boolean;
  tapOnly?: boolean;
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
  hostMode: HostMode;
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
  overridden?: boolean;
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
