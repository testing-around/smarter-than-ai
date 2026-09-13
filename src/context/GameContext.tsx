import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ClickerWho } from '../components/ClickerPanel';
import { AI_PLAYER, FAMILY_PLAYERS, createPlayer } from '../data/players';
import { correctChoiceIndex, isBossQuestion } from '../data/questionAccess';
import { isEarlyShoutArmed } from '../game/earlyShout';
import {
  bannerFor,
  canAcceptAnswers,
  canStartListening,
  shouldAdvanceAfterJudgment,
} from '../game/phases';
import { createQuestionSessionId, isLiveSession } from '../game/session';
import {
  evaluateTranscript,
  isContestantInterrupt,
  judgeChoice,
  whoSaidPrompt,
} from '../services/answerJudgeEngine';
import { buildVoiceProfile, canMarkVoiceReady } from '../game/enrollmentMachine';
import {
  SPEAKER_AUTO_THRESHOLD,
  guessSpeaker,
  shouldAskWhoSaidThat,
} from '../services/speakerMatch';
import {
  loadVoiceProfiles,
  profileForPlayer,
  saveVoiceProfiles,
  upsertProfile,
} from '../services/voiceProfiles';
import { appendGameEvent, createGameEvent } from '../services/gameEventLog';
import { buildQuestionUtterance, speakQuestion } from '../services/hostQuestionEngine';
import { closePlayerMic, startPlayerListening } from '../services/playerListeningEngine';
import {
  nextAdaptiveDifficulty,
  pickDeck,
  takeMatching,
} from '../services/questionBank';
import { scoreForAnswer } from '../services/scoring';
import {
  DEFAULT_SETTINGS,
  loadPersisted,
  mergeLeaderboard,
  saveLeaderboard,
  savePlayers,
  saveSettings,
} from '../services/storage';
import { configureHostVoice, hostCopy, hostSay, stopHostVoice } from '../services/tts';
import { warmHostVoice } from '../services/hostVoice';
import { checkVoiceAvailable } from '../services/voice';
import type {
  AnswerMode,
  AnswerSource,
  GameDifficulty,
  GameEvent,
  GameEventType,
  GameSettings,
  LeaderboardRow,
  PendingAnswer,
  PhaseBannerId,
  Player,
  Question,
  QuestionDifficulty,
  QuickModeId,
  RoundPhase,
  RoundResult,
  ScreenName,
  EnrollmentSample,
  VoiceProfile,
  VoiceStatus,
  WhoSaidThat,
} from '../types';

const QUICK_MODES: Record<
  QuickModeId,
  Partial<GameSettings> & { beatTheAi: boolean }
> = {
  family: {
    questionCount: 10,
    answerMode: 'shout',
    difficulty: 'adaptive',
    timerSeconds: 15,
    beatTheAi: false,
    earlyShoutOut: true,
  },
  lightning: {
    questionCount: 5,
    answerMode: 'shout',
    difficulty: 'easy',
    timerSeconds: 8,
    beatTheAi: false,
    earlyShoutOut: true,
  },
  beatAi: {
    questionCount: 10,
    answerMode: 'shout',
    difficulty: 'adaptive',
    timerSeconds: 15,
    beatTheAi: true,
    earlyShoutOut: true,
  },
  grade: {
    questionCount: 10,
    answerMode: 'turn',
    difficulty: 'hard',
    timerSeconds: 20,
    beatTheAi: false,
    earlyShoutOut: false,
  },
};

const FEEDBACK_PAUSE_MS = 700;

interface GameContextValue {
  screen: ScreenName;
  players: Player[];
  settings: GameSettings;
  leaderboard: LeaderboardRow[];
  voice: VoiceStatus;
  hostLine: string;
  transcript: string;
  listening: boolean;
  current: Question | null;
  questionNumber: number;
  questionTotal: number;
  timeLeft: number;
  locked: boolean;
  isBoss: boolean;
  multiplier: number;
  buzzedPlayerId: string | null;
  turnPlayerId: string | null;
  whoSaidThat: WhoSaidThat | null;
  lastResult: RoundResult | null;
  results: RoundResult[];
  hydrated: boolean;
  phase: RoundPhase;
  banner: PhaseBannerId;
  sessionId: string;
  hostSpeaking: boolean;
  pendingAnswer: PendingAnswer | null;
  clickerOpen: boolean;
  clickerWho: ClickerWho | null;
  clickerCorrect: boolean | null;
  paused: boolean;
  canAdvance: boolean;
  eventLog: GameEvent[];
  ttsFailed: boolean;
  interruptAlert: boolean;
  goHome: () => void;
  goSetup: () => void;
  applyQuickMode: (id: QuickModeId) => void;
  setPlayerName: (id: string, name: string) => void;
  setPlayerEmoji: (id: string, emoji: string) => void;
  addPlayer: () => void;
  removePlayer: (id: string) => void;
  loadFamily: () => void;
  patchSettings: (patch: Partial<GameSettings>) => void;
  continueToVoiceCheck: () => void;
  voiceProfiles: VoiceProfile[];
  completeVoiceEnrollment: (
    playerId: string,
    name: string,
    samples: EnrollmentSample[],
  ) => VoiceProfile;
  skipPlayerVoice: (id: string) => void;
  skipVoiceAndLobby: () => void;
  finishVoiceCheck: () => void;
  startMatch: () => void;
  submitAnswer: (playerId: string, choiceIndex: number, source: AnswerSource) => void;
  tapChoice: (choiceIndex: number) => void;
  buzzIn: (playerId: string) => void;
  claimAnswer: (playerId: string) => void;
  continueAfterRound: () => void;
  rematch: () => void;
  listenNow: () => void;
  pauseRound: () => void;
  resumeRound: () => void;
  repeatQuestion: () => void;
  skipQuestion: () => void;
  stopHostSpeaking: () => void;
  retryHostSpeech: () => void;
  skipToListening: () => void;
  setClickerWho: (who: ClickerWho) => void;
  setClickerCorrect: (value: boolean | null) => void;
  confirmClicker: () => void;
  logSpeakerCorrection: (fromId: string | null, toId: string) => void;
  logTranscriptCorrection: (fromText: string, toText: string) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

function withAi(players: Player[], beatTheAi: boolean): Player[] {
  const humans = players.filter((p) => !p.isAi);
  if (!beatTheAi) {
    return humans;
  }
  if (humans.some((p) => p.isAi) || players.some((p) => p.isAi)) {
    return [...humans, { ...AI_PLAYER, score: 0 }];
  }
  return [...humans, { ...AI_PLAYER, score: 0 }];
}

function aiAccuracy(difficulty: GameDifficulty): number {
  if (difficulty === 'easy') {
    return 0.9;
  }
  if (difficulty === 'hard') {
    return 0.45;
  }
  return 0.7;
}

function aiDelayMs(timerSeconds: number): number {
  return Math.min(timerSeconds * 1000 - 800, 1800 + Math.random() * 2800);
}

function usesClicker(mode: GameSettings['hostMode']): boolean {
  return mode === 'AI_HOST_PLUS_HUMAN_CLICKER' || mode === 'HUMAN_HOST_PLUS_AI_ASSIST';
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<ScreenName>('HOME');
  const [players, setPlayers] = useState<Player[]>(FAMILY_PLAYERS.map((p) => ({ ...p })));
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [voice, setVoice] = useState<VoiceStatus>({
    available: false,
    detail: 'Checking speech recognition…',
  });
  const [hostLine, setHostLine] = useState('Are you smarter than an AI?');
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const [remaining, setRemaining] = useState<Question[]>([]);
  const [current, setCurrent] = useState<Question | null>(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [locked, setLocked] = useState(false);
  const [isBoss, setIsBoss] = useState(false);
  const [adaptiveLevel, setAdaptiveLevel] = useState<QuestionDifficulty>('medium');
  const [buzzedPlayerId, setBuzzedPlayerId] = useState<string | null>(null);
  const [turnIndex, setTurnIndex] = useState(0);
  const [whoSaidThat, setWhoSaidThat] = useState<WhoSaidThat | null>(null);
  const [lastResult, setLastResult] = useState<RoundResult | null>(null);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [phase, setPhase] = useState<RoundPhase>('IDLE');
  const [banner, setBanner] = useState<PhaseBannerId>('asking');
  const [sessionId, setSessionId] = useState('');
  const [hostSpeaking, setHostSpeaking] = useState(false);
  const [pendingAnswer, setPendingAnswer] = useState<PendingAnswer | null>(null);
  const [clickerOpen, setClickerOpen] = useState(false);
  const [clickerWho, setClickerWhoState] = useState<ClickerWho | null>(null);
  const [clickerCorrect, setClickerCorrectState] = useState<boolean | null>(null);
  const [paused, setPaused] = useState(false);
  const [canAdvance, setCanAdvance] = useState(false);
  const [eventLog, setEventLog] = useState<GameEvent[]>([]);
  const [ttsFailed, setTtsFailed] = useState(false);
  const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfile[]>([]);
  const [interruptAlert, setInterruptAlert] = useState(false);

  const playersRef = useRef(players);
  const settingsRef = useRef(settings);
  const currentRef = useRef(current);
  const lockedRef = useRef(locked);
  const startedAtRef = useRef(0);
  const timerArmedRef = useRef(false);
  const buzzedRef = useRef<string | null>(null);
  const turnRef = useRef(0);
  const whoRef = useRef<WhoSaidThat | null>(null);
  const resultsRef = useRef<RoundResult[]>([]);
  const remainingRef = useRef<Question[]>([]);
  const questionNumberRef = useRef(0);
  const adaptiveRef = useRef<QuestionDifficulty>('medium');
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingClaimRef = useRef<{ choiceIndex: number; responseMs: number } | null>(
    null,
  );
  const sessionIdRef = useRef('');
  const phaseRef = useRef<RoundPhase>('IDLE');
  const hostSpeakingRef = useRef(false);
  const pausedRef = useRef(false);
  const pausedFromRef = useRef<RoundPhase>('IDLE');
  const lastCorrectRef = useRef<boolean | null>(null);
  const clickerOpenRef = useRef(false);
  const pendingAnswerRef = useRef<PendingAnswer | null>(null);
  const voiceAvailableRef = useRef(false);
  const isBossRef = useRef(false);
  const questionTotalRef = useRef(10);
  const voiceProfilesRef = useRef<VoiceProfile[]>([]);
  const listenStartedAtRef = useRef(0);
  const interruptRef = useRef(false);
  const resumeAfterWrongRef = useRef<(sessionId: string, question: Question) => void>(
    () => undefined,
  );

  playersRef.current = players;
  settingsRef.current = settings;
  currentRef.current = current;
  lockedRef.current = locked;
  buzzedRef.current = buzzedPlayerId;
  turnRef.current = turnIndex;
  whoRef.current = whoSaidThat;
  resultsRef.current = results;
  remainingRef.current = remaining;
  questionNumberRef.current = questionNumber;
  adaptiveRef.current = adaptiveLevel;
  clickerOpenRef.current = clickerOpen;
  pendingAnswerRef.current = pendingAnswer;
  voiceAvailableRef.current = voice.available;
  isBossRef.current = isBoss;
  questionTotalRef.current = settings.questionCount;
  voiceProfilesRef.current = voiceProfiles;

  const turnPlayerId = players[turnIndex % Math.max(players.length, 1)]?.id ?? null;
  const multiplier = isBoss ? 3 : 1;

  const logEvent = useCallback((type: GameEventType, detail?: string) => {
    const event = createGameEvent(
      type,
      sessionIdRef.current,
      currentRef.current?.question_id ?? null,
      detail,
    );
    setEventLog((prev) => appendGameEvent(prev, event));
  }, []);

  const applyPhase = useCallback((next: RoundPhase) => {
    phaseRef.current = next;
    setPhase(next);
    setBanner(
      bannerFor(next, lastCorrectRef.current, {
        earlyShoutOut: isEarlyShoutArmed(settingsRef.current),
        interrupt: interruptRef.current,
      }),
    );
  }, []);

  const haltHostForInterrupt = useCallback(() => {
    if (hostSpeakingRef.current) {
      void stopHostVoice();
      hostSpeakingRef.current = false;
      setHostSpeaking(false);
    }
    interruptRef.current = true;
    setInterruptAlert(true);
    logEvent('EARLY_INTERRUPT');
    setBanner(
      bannerFor('ANSWER_DETECTED', null, {
        earlyShoutOut: true,
        interrupt: true,
      }),
    );
  }, [logEvent]);

  const beginSession = useCallback((questionId: string) => {
    const next = createQuestionSessionId(questionId);
    sessionIdRef.current = next;
    setSessionId(next);
    return next;
  }, []);

  const isCurrentSession = useCallback((id: string) => {
    return isLiveSession(id, sessionIdRef.current);
  }, []);

  const ttsRequest = useCallback(
    (id: string) => ({
      sessionId: id,
      isCurrent: () => isCurrentSession(id),
    }),
    [isCurrentSession],
  );

  const setLine = useCallback((line: string, speak = true) => {
    setHostLine(line);
    if (speak) {
      void hostSay(line);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = await loadPersisted();
      const [voiceStatus, profiles] = await Promise.all([
        checkVoiceAvailable(),
        loadVoiceProfiles(),
      ]);
      if (cancelled) {
        return;
      }
      setPlayers(saved.players);
      setSettings(saved.settings);
      setLeaderboard(saved.leaderboard);
      setVoiceProfiles(profiles);
      voiceProfilesRef.current = profiles;
      configureHostVoice(saved.settings.hostVoice ?? 'british-female');
      void warmHostVoice();
      setVoice(voiceStatus);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistRoster = useCallback(async (nextPlayers: Player[], nextSettings: GameSettings) => {
    await Promise.all([savePlayers(nextPlayers), saveSettings(nextSettings)]);
  }, []);

  const clearAiTimer = useCallback(() => {
    if (aiTimerRef.current) {
      clearTimeout(aiTimerRef.current);
      aiTimerRef.current = null;
    }
  }, []);

  const clearFeedbackTimer = useCallback(() => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
  }, []);

  const resetRoundUi = useCallback(() => {
    setWhoSaidThat(null);
    whoRef.current = null;
    setPendingAnswer(null);
    pendingAnswerRef.current = null;
    setClickerOpen(false);
    clickerOpenRef.current = false;
    setClickerWhoState(null);
    setClickerCorrectState(null);
    setTranscript('');
    setTtsFailed(false);
    setInterruptAlert(false);
    interruptRef.current = false;
    setPaused(false);
    pausedRef.current = false;
    setCanAdvance(false);
    lastCorrectRef.current = null;
    pendingClaimRef.current = null;
  }, []);

  const goHome = useCallback(() => {
    clearAiTimer();
    clearFeedbackTimer();
    void closePlayerMic();
    void stopHostVoice();
    hostSpeakingRef.current = false;
    setHostSpeaking(false);
    setListening(false);
    timerArmedRef.current = false;
    applyPhase('IDLE');
    setScreen('HOME');
    setLocked(false);
    lockedRef.current = false;
    setCurrent(null);
    resetRoundUi();
    setLine(hostCopy.welcome, false);
  }, [applyPhase, clearAiTimer, clearFeedbackTimer, resetRoundUi, setLine]);

  const goSetup = useCallback(() => {
    setScreen('SETUP');
    setLine('Set the rules, then enroll voices.', false);
  }, [setLine]);

  const applyQuickMode = useCallback(
    (id: QuickModeId) => {
      const preset = QUICK_MODES[id];
      setSettings((prev) => ({ ...prev, ...preset, voiceEnabled: true }));
      if (preset.beatTheAi) {
        setPlayers((prev) => withAi(prev, true));
      } else {
        setPlayers((prev) => prev.filter((p) => !p.isAi));
      }
      setScreen('SETUP');
      setLine('Quick mode loaded. Tweak anything, then continue.');
    },
    [setLine],
  );

  const setPlayerName = useCallback((id: string, name: string) => {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }, []);

  const setPlayerEmoji = useCallback((id: string, emoji: string) => {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, emoji } : p)));
  }, []);

  const addPlayer = useCallback(() => {
    setPlayers((prev) => {
      if (prev.filter((p) => !p.isAi).length >= 6) {
        return prev;
      }
      return [...prev, createPlayer(`Player ${prev.length + 1}`, '🌟')];
    });
  }, []);

  const removePlayer = useCallback((id: string) => {
    setPlayers((prev) => {
      const next = prev.filter((p) => p.id !== id);
      return next.length ? next : prev;
    });
  }, []);

  const loadFamily = useCallback(() => {
    setPlayers(FAMILY_PLAYERS.map((p) => ({ ...p })));
  }, []);

  const patchSettings = useCallback((patch: Partial<GameSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    const beatTheAi = patch.beatTheAi;
    if (beatTheAi !== undefined) {
      setPlayers((prev) => withAi(prev, beatTheAi));
    }
    if (patch.hostVoice) {
      configureHostVoice(patch.hostVoice);
      void warmHostVoice();
    }
  }, []);

  const continueToVoiceCheck = useCallback(() => {
    const roster = withAi(playersRef.current, settingsRef.current.beatTheAi).map((p) => {
      const saved = profileForPlayer(voiceProfilesRef.current, p.id);
      const name = p.name.trim() || 'Player';
      const ready =
        Boolean(p.isAi) ||
        (saved?.quality.voiceReady &&
          saved.name.trim().toLowerCase() === name.toLowerCase());
      return {
        ...p,
        name,
        score: 0,
        enrolled: Boolean(ready),
        voiceReady: Boolean(ready),
        tapOnly: false,
      };
    });
    setPlayers(roster);
    void persistRoster(roster, settingsRef.current);
    setScreen('VOICE_CHECK');
    setLine('Train each voice with a few short phrases, or skip to tap-only.');
  }, [persistRoster, setLine]);

  const completeVoiceEnrollment = useCallback(
    (playerId: string, name: string, samples: EnrollmentSample[]): VoiceProfile => {
      const profile = buildVoiceProfile(playerId, name, samples);
      const ready = canMarkVoiceReady(profile);
      if (ready) {
        setPlayers((prev) =>
          prev.map((p) =>
            p.id === playerId
              ? { ...p, enrolled: true, voiceReady: true, tapOnly: false }
              : p,
          ),
        );
      }
      setVoiceProfiles((prev) => {
        const next = upsertProfile(prev, profile);
        voiceProfilesRef.current = next;
        void saveVoiceProfiles(next);
        return next;
      });
      return profile;
    },
    [],
  );

  const skipPlayerVoice = useCallback((id: string) => {
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, enrolled: false, voiceReady: false, tapOnly: true } : p,
      ),
    );
  }, []);

  const skipVoiceAndLobby = useCallback(() => {
    setSettings((prev) => ({ ...prev, voiceEnabled: false }));
    setPlayers((prev) =>
      prev.map((p) =>
        p.isAi ? p : { ...p, enrolled: false, voiceReady: false, tapOnly: true },
      ),
    );
    setScreen('LOBBY');
    const names = playersRef.current.map((p) => p.name).join(', ');
    setLine(hostCopy.lobby(names));
  }, [setLine]);

  const finishVoiceCheck = useCallback(() => {
    const humans = playersRef.current.filter((p) => !p.isAi);
    const voiceOn = settingsRef.current.voiceEnabled && voiceAvailableRef.current;
    if (voiceOn && humans.some((p) => !p.voiceReady && !p.tapOnly)) {
      return;
    }
    if (!humans.some((p) => p.voiceReady)) {
      setSettings((prev) => ({ ...prev, voiceEnabled: false }));
    }
    setScreen('LOBBY');
    const names = playersRef.current.map((p) => p.name).join(', ');
    setLine(hostCopy.lobby(names));
  }, [setLine]);

  const resolveRound = useCallback(
    (input: {
      player: Player | null;
      choiceIndex: number | null;
      source: AnswerSource;
      responseMs: number;
      timedOut: boolean;
      correctOverride?: boolean;
      sessionId: string;
    }) => {
      if (!isCurrentSession(input.sessionId)) {
        return;
      }
      const question = currentRef.current;
      if (!question || lockedRef.current) {
        return;
      }
      lockedRef.current = true;
      setLocked(true);
      clearAiTimer();
      void closePlayerMic();
      setListening(false);
      timerArmedRef.current = false;
      setWhoSaidThat(null);
      whoRef.current = null;
      setClickerOpen(false);
      clickerOpenRef.current = false;
      applyPhase('ANSWER_JUDGING');

      const suggested = judgeChoice(question, input.choiceIndex);
      const correct = input.correctOverride ?? suggested;
      const overridden = input.correctOverride !== undefined && input.correctOverride !== suggested;
      if (overridden) {
        logEvent('JUDGMENT_OVERRIDE', `${suggested} → ${correct}`);
      }
      applyPhase('SCORE_UPDATE');
      const boss = isBossQuestion(question, isBossRef.current);
      const points = scoreForAnswer(correct, input.responseMs, boss ? 3 : 1, question);
      const result: RoundResult = {
        question,
        playerId: input.player?.id ?? null,
        playerName: input.player?.name ?? null,
        choiceIndex: input.choiceIndex,
        correct,
        points,
        responseMs: input.responseMs,
        timedOut: input.timedOut,
        source: input.source,
        isBoss: boss,
        overridden,
      };

      lastCorrectRef.current = input.timedOut ? false : correct;
      logEvent(
        'ANSWER_JUDGED',
        `${input.player?.name ?? 'none'} ${correct ? 'correct' : 'wrong'} ${input.source}`,
      );

      if (input.player && points > 0) {
        setPlayers((prev) =>
          prev.map((p) => (p.id === input.player?.id ? { ...p, score: p.score + points } : p)),
        );
        logEvent('SCORE_UPDATED', `${input.player.name} +${points}`);
      }

      const stayLive = !shouldAdvanceAfterJudgment(
        correct,
        input.timedOut,
        isEarlyShoutArmed(settingsRef.current),
      );

      let line = hostCopy.timeout;
      if (!input.timedOut && input.player && correct) {
        line = hostCopy.correct(input.player.name);
      } else if (!input.timedOut && input.player) {
        line = hostCopy.wrong(input.player.name);
      }

      if (stayLive) {
        setInterruptAlert(false);
        logEvent('WRONG_STAY', input.player?.name ?? 'unknown');
        setHostLine(line);
        applyPhase('HOST_FEEDBACK');
        void (async () => {
          await hostSay(line, ttsRequest(input.sessionId));
          if (!isCurrentSession(input.sessionId)) {
            return;
          }
          hostSpeakingRef.current = false;
          setHostSpeaking(false);
          resumeAfterWrongRef.current(input.sessionId, question);
        })();
        return;
      }

      setLastResult(result);
      setResults((prev) => [...prev, result]);
      setScreen('ROUND_RESULT');
      applyPhase('HOST_FEEDBACK');
      setHostLine(line);
      hostSpeakingRef.current = true;
      setHostSpeaking(true);
      logEvent('HOST_RESPONSE_STARTED', line);

      void (async () => {
        const outcome = await hostSay(line, ttsRequest(input.sessionId));
        if (!isCurrentSession(input.sessionId)) {
          return;
        }
        hostSpeakingRef.current = false;
        setHostSpeaking(false);
        if (outcome === 'done') {
          logEvent('HOST_RESPONSE_FINISHED', 'done');
        } else {
          logEvent('HOST_RESPONSE_FINISHED', outcome);
        }
        applyPhase('HOST_FEEDBACK_TTS_COMPLETE');
        clearFeedbackTimer();
        feedbackTimerRef.current = setTimeout(() => {
          if (!isCurrentSession(input.sessionId)) {
            return;
          }
          setCanAdvance(true);
          if (settingsRef.current.hostMode === 'FULL_AI_HOST') {
            continueAfterRoundRef.current();
          }
        }, FEEDBACK_PAUSE_MS);
      })();
    },
    [applyPhase, clearAiTimer, clearFeedbackTimer, isCurrentSession, logEvent, ttsRequest],
  );

  const continueAfterRoundRef = useRef<() => void>(() => undefined);

  const submitAnswer = useCallback(
    (playerId: string, choiceIndex: number, source: AnswerSource) => {
      const early = isEarlyShoutArmed(settingsRef.current);
      if (!canAcceptAnswers(phaseRef.current, early) || lockedRef.current) {
        return;
      }
      if (hostSpeakingRef.current && !early) {
        return;
      }
      if (whoRef.current || clickerOpenRef.current) {
        return;
      }
      if (early && hostSpeakingRef.current) {
        haltHostForInterrupt();
      }
      const cfg = settingsRef.current;
      const roster = playersRef.current;
      const player = roster.find((p) => p.id === playerId);
      if (!player) {
        return;
      }

      if (cfg.answerMode === 'turn') {
        const currentTurn = roster[turnRef.current % roster.length];
        if (currentTurn && currentTurn.id !== playerId && source !== 'ai') {
          return;
        }
      }

      if (cfg.answerMode === 'buzz' && source !== 'ai') {
        if (!buzzedRef.current) {
          buzzedRef.current = playerId;
          setBuzzedPlayerId(playerId);
          if (source === 'tap') {
            return;
          }
        } else if (buzzedRef.current !== playerId) {
          return;
        }
      }

      applyPhase('ANSWER_DETECTED');
      resolveRound({
        player,
        choiceIndex,
        source,
        responseMs: timerArmedRef.current ? Date.now() - startedAtRef.current : 0,
        timedOut: false,
        sessionId: sessionIdRef.current,
      });
    },
    [applyPhase, haltHostForInterrupt, resolveRound],
  );

  const openWhoSaidThat = useCallback(
    (choiceIndex: number, heard: string) => {
      if (
        !canAcceptAnswers(phaseRef.current, isEarlyShoutArmed(settingsRef.current)) ||
        lockedRef.current ||
        whoRef.current
      ) {
        return;
      }
      applyPhase('SPEAKER_IDENTIFICATION');
      pendingClaimRef.current = {
        choiceIndex,
        responseMs: timerArmedRef.current ? Date.now() - startedAtRef.current : 0,
      };
      const question = currentRef.current;
      const label = question?.choices[choiceIndex] ?? heard;
      setWhoSaidThat({ transcript: heard, choiceIndex });
      void closePlayerMic();
      setListening(false);
      clearAiTimer();
      logEvent('SPEAKER_UNKNOWN', heard);
      setLine(whoSaidPrompt(heard, label), true);
    },
    [applyPhase, clearAiTimer, logEvent, setLine],
  );

  const openClicker = useCallback(
    (pending: PendingAnswer) => {
      applyPhase('SPEAKER_IDENTIFICATION');
      pendingAnswerRef.current = pending;
      setPendingAnswer(pending);
      setClickerOpen(true);
      clickerOpenRef.current = true;
      setClickerWhoState(pending.suggestedPlayerId);
      setClickerCorrectState(null);
      void closePlayerMic();
      setListening(false);
      clearAiTimer();
      const question = currentRef.current;
      const label = question?.choices[pending.choiceIndex] ?? pending.transcript;
      logEvent(
        pending.suggestedPlayerId ? 'SPEAKER_GUESSED' : 'SPEAKER_UNKNOWN',
        pending.transcript,
      );
      setLine(whoSaidPrompt(pending.transcript, label), true);
    },
    [applyPhase, clearAiTimer, logEvent, setLine],
  );

  const tapChoice = useCallback(
    (choiceIndex: number) => {
      const early = isEarlyShoutArmed(settingsRef.current);
      if (!canAcceptAnswers(phaseRef.current, early) || lockedRef.current) {
        return;
      }
      if (hostSpeakingRef.current && !early) {
        return;
      }
      if (whoRef.current || clickerOpenRef.current) {
        return;
      }
      if (early && hostSpeakingRef.current) {
        haltHostForInterrupt();
      }
      const cfg = settingsRef.current;
      const roster = playersRef.current;
      const responseMs = timerArmedRef.current ? Date.now() - startedAtRef.current : 0;
      const pending: PendingAnswer = {
        transcript: 'Tapped answer',
        choiceIndex,
        suggestedPlayerId:
          cfg.answerMode === 'turn'
            ? (roster[turnRef.current % roster.length]?.id ?? null)
            : cfg.answerMode === 'buzz'
              ? buzzedRef.current
              : roster.filter((p) => !p.isAi).length === 1
                ? (roster.find((p) => !p.isAi)?.id ?? null)
                : null,
        suggestedCorrect: judgeChoice(currentRef.current!, choiceIndex),
        responseMs,
        overlap: 'SINGLE',
      };

      if (usesClicker(cfg.hostMode)) {
        openClicker(pending);
        return;
      }

      if (cfg.answerMode === 'turn') {
        const currentTurn = roster[turnRef.current % roster.length];
        if (currentTurn && !currentTurn.isAi) {
          submitAnswer(currentTurn.id, choiceIndex, 'tap');
        }
        return;
      }
      if (cfg.answerMode === 'buzz') {
        if (buzzedRef.current) {
          submitAnswer(buzzedRef.current, choiceIndex, 'buzz');
        }
        return;
      }
      const humans = roster.filter((p) => !p.isAi);
      if (humans.length === 1 && humans[0]) {
        submitAnswer(humans[0].id, choiceIndex, 'tap');
        return;
      }
      openWhoSaidThat(choiceIndex, 'Tapped answer — who claimed it?');
    },
    [haltHostForInterrupt, openClicker, openWhoSaidThat, submitAnswer],
  );

  const handleTranscript = useCallback(
    (text: string, isFinal: boolean) => {
      setTranscript(text);
      logEvent(isFinal ? 'SPEECH_FINAL' : 'SPEECH_PARTIAL', text);
      const early = isEarlyShoutArmed(settingsRef.current);
      if (
        !canAcceptAnswers(phaseRef.current, early) ||
        lockedRef.current ||
        whoRef.current ||
        clickerOpenRef.current
      ) {
        return;
      }
      if (hostSpeakingRef.current && !early) {
        return;
      }
      const question = currentRef.current;
      if (!question) {
        return;
      }
      if (early && phaseRef.current === 'HOST_SPEAKING') {
        if (!isContestantInterrupt(text, question, playersRef.current)) {
          return;
        }
        const named = playersRef.current.some(
          (p) => !p.isAi && text.toLowerCase().includes(p.name.toLowerCase()),
        );
        if (!isFinal && !named) {
          return;
        }
        haltHostForInterrupt();
      }
      const responseMs = timerArmedRef.current ? Date.now() - startedAtRef.current : 0;
      const pending = evaluateTranscript(text, playersRef.current, question, responseMs);
      if (!pending) {
        return;
      }
      const durationMs = listenStartedAtRef.current
        ? Date.now() - listenStartedAtRef.current
        : responseMs;
      const guess = guessSpeaker(
        text,
        durationMs,
        playersRef.current,
        voiceProfilesRef.current,
      );
      pending.speakerGuess = guess.playerId;
      pending.speakerConfidence = guess.confidence;
      if (guess.playerId) {
        pending.suggestedPlayerId = guess.playerId;
      }
      logEvent(
        'TRANSCRIPT',
        `${text} · guess=${guess.playerId ?? 'none'} ${Math.round(guess.confidence * 100)}%`,
      );

      const cfg = settingsRef.current;
      if (usesClicker(cfg.hostMode) || pending.overlap === 'MULTIPLE_SPEAKERS') {
        openClicker({
          ...pending,
          suggestedPlayerId: guess.playerId ?? pending.suggestedPlayerId,
        });
        return;
      }

      if (
        pending.suggestedPlayerId &&
        !shouldAskWhoSaidThat(guess) &&
        guess.confidence >= SPEAKER_AUTO_THRESHOLD
      ) {
        if (cfg.answerMode === 'turn') {
          const currentTurn = playersRef.current[turnRef.current % playersRef.current.length];
          if (currentTurn && currentTurn.id !== pending.suggestedPlayerId) {
            return;
          }
        }
        logEvent(
          'SPEAKER_IDENTIFIED',
          `${pending.suggestedPlayerId} ${Math.round(guess.confidence * 100)}%`,
        );
        submitAnswer(pending.suggestedPlayerId, pending.choiceIndex, 'voice');
        return;
      }

      if (cfg.answerMode === 'turn') {
        const currentTurn = playersRef.current[turnRef.current % playersRef.current.length];
        if (currentTurn && !currentTurn.isAi) {
          submitAnswer(currentTurn.id, pending.choiceIndex, 'voice');
        }
        return;
      }

      if (cfg.answerMode === 'buzz' && buzzedRef.current) {
        submitAnswer(buzzedRef.current, pending.choiceIndex, 'voice');
        return;
      }

      if (isFinal || !pending.suggestedPlayerId) {
        openWhoSaidThat(pending.choiceIndex, text);
      }
    },
    [haltHostForInterrupt, logEvent, openClicker, openWhoSaidThat, submitAnswer],
  );

  const listeningGate = useCallback(
    () => ({
      sessionId: sessionIdRef.current,
      phase: phaseRef.current,
      hostSpeaking: hostSpeakingRef.current,
      listeningEnabled: settingsRef.current.voiceEnabled && voiceAvailableRef.current,
      earlyShoutOut: isEarlyShoutArmed(settingsRef.current),
    }),
    [],
  );

  const beginListening = useCallback(() => {
    const gate = listeningGate();
    if (
      !canStartListening(
        gate.phase,
        gate.hostSpeaking,
        gate.listeningEnabled,
        gate.earlyShoutOut,
      )
    ) {
      return;
    }
    const question = currentRef.current;
    const phrases = [
      ...playersRef.current.map((p) => p.name),
      'A',
      'B',
      'C',
      'D',
      'option A',
      'option B',
      'option C',
      'option D',
      ...(question?.choices ?? []),
      ...(question?.accepted_answers ?? []),
    ];
    void startPlayerListening(listeningGate, phrases, {
      onStart: () => {
        listenStartedAtRef.current = Date.now();
        setListening(true);
        logEvent('MIC_OPENED');
      },
      onEnd: () => {
        setListening(false);
        logEvent('MIC_CLOSED');
      },
      onPartial: (text) => handleTranscript(text, false),
      onFinal: (text) => handleTranscript(text, true),
      onError: () => setListening(false),
    });
  }, [handleTranscript, listeningGate, logEvent]);

  const listenNow = useCallback(() => {
    const early = isEarlyShoutArmed(settingsRef.current);
    if (!canAcceptAnswers(phaseRef.current, early)) {
      return;
    }
    if (hostSpeakingRef.current && !early) {
      return;
    }
    beginListening();
  }, [beginListening]);

  const scheduleAi = useCallback(
    (question: Question, mode: AnswerMode, liveSession: string) => {
      clearAiTimer();
      const roster = playersRef.current;
      const bot = roster.find((p) => p.isAi);
      if (!bot || !settingsRef.current.beatTheAi) {
        return;
      }
      aiTimerRef.current = setTimeout(() => {
        if (!isCurrentSession(liveSession)) {
          return;
        }
        if (
          phaseRef.current === 'HOST_SPEAKING' ||
          hostSpeakingRef.current ||
          !canAcceptAnswers(phaseRef.current)
        ) {
          return;
        }
        if (lockedRef.current || whoRef.current || clickerOpenRef.current) {
          return;
        }
        if (mode === 'turn') {
          const currentTurn = roster[turnRef.current % roster.length];
          if (currentTurn?.id !== bot.id) {
            return;
          }
        }
        const hits = Math.random() < aiAccuracy(settingsRef.current.difficulty);
        const correctIndex = correctChoiceIndex(question);
        const wrongPool = question.choices
          .map((_, index) => index)
          .filter((i) => i !== correctIndex);
        const pick = hits
          ? correctIndex
          : (wrongPool[Math.floor(Math.random() * wrongPool.length)] ?? 0);
        submitAnswer(bot.id, pick, 'ai');
      }, aiDelayMs(settingsRef.current.timerSeconds));
    },
    [clearAiTimer, isCurrentSession, submitAnswer],
  );

  const unlockListening = useCallback(
    (liveSession: string, question: Question) => {
      if (!isCurrentSession(liveSession) || lockedRef.current) {
        return;
      }
      applyPhase('HOST_SPEECH_FINISHED');
      applyPhase('LISTENING_FOR_PLAYERS');
      startedAtRef.current = Date.now();
      timerArmedRef.current = true;
      setTimeLeft(settingsRef.current.timerSeconds);
      setHostLine(hostCopy.listening);
      logEvent('TTS_FINISHED');
      beginListening();
      scheduleAi(question, settingsRef.current.answerMode, liveSession);
    },
    [applyPhase, beginListening, isCurrentSession, logEvent, scheduleAi],
  );

  const resumeAfterWrong = useCallback(
    (liveSession: string, question: Question) => {
      if (!isCurrentSession(liveSession)) {
        return;
      }
      if (currentRef.current?.question_id !== question.question_id) {
        return;
      }
      interruptRef.current = false;
      setInterruptAlert(false);
      clickerOpenRef.current = false;
      whoRef.current = null;
      pendingAnswerRef.current = null;
      pendingClaimRef.current = null;
      setClickerOpen(false);
      setWhoSaidThat(null);
      setPendingAnswer(null);
      setClickerWhoState(null);
      setClickerCorrectState(null);
      lockedRef.current = false;
      setLocked(false);
      lastCorrectRef.current = null;
      applyPhase('LISTENING_FOR_PLAYERS');
      startedAtRef.current = Date.now();
      timerArmedRef.current = true;
      setTimeLeft(settingsRef.current.timerSeconds);
      setHostLine(hostCopy.listening);
      beginListening();
      scheduleAi(question, settingsRef.current.answerMode, liveSession);
    },
    [applyPhase, beginListening, isCurrentSession, scheduleAi],
  );
  resumeAfterWrongRef.current = resumeAfterWrong;

  const readQuestion = useCallback(
    async (question: Question, number: number, total: number, liveSession: string) => {
      const boss = isBossQuestion(question, number === total);
      lockedRef.current = false;
      setLocked(false);
      applyPhase('QUESTION_SELECTED');
      setCurrent(question);
      setQuestionNumber(number);
      setIsBoss(boss);
      isBossRef.current = boss;
      setTimeLeft(settingsRef.current.timerSeconds);
      timerArmedRef.current = false;
      startedAtRef.current = 0;
      setBuzzedPlayerId(null);
      buzzedRef.current = null;
      resetRoundUi();
      setScreen('GAME');
      applyPhase('QUESTION_DISPLAYED');
      logEvent('QUESTION_LOADED', question.question_id);
      logEvent('DISPLAYED', question.question);

      const utterance = buildQuestionUtterance(question, number, boss);
      setHostLine(utterance);
      applyPhase('HOST_SPEAKING');
      hostSpeakingRef.current = true;
      setHostSpeaking(true);
      logEvent('TTS_STARTED');

      if (isEarlyShoutArmed(settingsRef.current)) {
        beginListening();
      } else {
        void closePlayerMic();
        setListening(false);
      }

      const outcome = await speakQuestion(question, number, boss, ttsRequest(liveSession));
      if (!isCurrentSession(liveSession)) {
        return;
      }

      const interruptInFlight =
        interruptRef.current ||
        clickerOpenRef.current ||
        Boolean(whoRef.current) ||
        lockedRef.current;

      hostSpeakingRef.current = false;
      setHostSpeaking(false);

      if (interruptInFlight) {
        if (outcome === 'stopped') {
          logEvent('TTS_STOPPED', 'interrupt');
        }
        return;
      }

      if (outcome === 'done') {
        unlockListening(liveSession, question);
        return;
      }
      if (outcome === 'stopped') {
        applyPhase('HOST_STOPPED');
        logEvent('TTS_STOPPED');
        return;
      }
      applyPhase('TTS_ERROR');
      setTtsFailed(true);
      logEvent('TTS_ERROR', outcome);
      setHostLine('Host voice failed. Retry, or read it yourself and start listening.');
    },
    [
      applyPhase,
      beginListening,
      isCurrentSession,
      logEvent,
      resetRoundUi,
      ttsRequest,
      unlockListening,
    ],
  );

  const openQuestion = useCallback(
    (question: Question, number: number, total: number) => {
      const live = beginSession(question.question_id);
      logEvent('NEXT_QUESTION', `${number}/${total}`);
      void readQuestion(question, number, total, live);
    },
    [beginSession, logEvent, readQuestion],
  );

  const startMatch = useCallback(() => {
    const cfg = settingsRef.current;
    const humans = playersRef.current.filter((p) => !p.isAi);
    if (cfg.voiceEnabled && humans.some((p) => !p.voiceReady && !p.tapOnly)) {
      setScreen('VOICE_CHECK');
      setLine('Train or skip each voice before the host starts listening.');
      return;
    }
    const roster = withAi(playersRef.current, cfg.beatTheAi).map((p) => ({
      ...p,
      score: 0,
    }));
    setPlayers(roster);
    const deck = pickDeck(cfg.questionCount, cfg.difficulty);
    const firstDifficulty: QuestionDifficulty =
      cfg.difficulty === 'easy' ? 'easy' : cfg.difficulty === 'hard' ? 'hard' : 'medium';
    const { next, rest } = takeMatching(deck, firstDifficulty);
    setRemaining(rest);
    remainingRef.current = rest;
    setAdaptiveLevel(firstDifficulty);
    adaptiveRef.current = firstDifficulty;
    setResults([]);
    resultsRef.current = [];
    setTurnIndex(0);
    turnRef.current = 0;
    setLastResult(null);
    setEventLog([]);
    openQuestion(next, 1, cfg.questionCount);
  }, [openQuestion]);

  const buzzIn = useCallback(
    (playerId: string) => {
      if (!canAcceptAnswers(phaseRef.current) || hostSpeakingRef.current) {
        return;
      }
      if (lockedRef.current || buzzedRef.current) {
        return;
      }
      buzzedRef.current = playerId;
      setBuzzedPlayerId(playerId);
      beginListening();
    },
    [beginListening],
  );

  const claimAnswer = useCallback(
    (playerId: string) => {
      const pending = pendingClaimRef.current;
      const player = playersRef.current.find((p) => p.id === playerId);
      if (!pending || !player) {
        return;
      }
      pendingClaimRef.current = null;
      setWhoSaidThat(null);
      whoRef.current = null;
      logEvent('SPEAKER_IDENTIFIED', player.name);
      resolveRound({
        player,
        choiceIndex: pending.choiceIndex,
        source: 'claim',
        responseMs: pending.responseMs,
        timedOut: false,
        sessionId: sessionIdRef.current,
      });
    },
    [logEvent, resolveRound],
  );

  const finishGame = useCallback(() => {
    const roster = [...playersRef.current].sort((a, b) => b.score - a.score);
    const nextBoard = mergeLeaderboard(leaderboard, roster);
    setLeaderboard(nextBoard);
    void saveLeaderboard(nextBoard);
    setScreen('FINAL');
    applyPhase('IDLE');
    const champ = roster[0];
    setLine(champ ? hostCopy.winner(champ.name) : hostCopy.timeout);
  }, [applyPhase, leaderboard, setLine]);

  const continueAfterRound = useCallback(() => {
    clearFeedbackTimer();
    void stopHostVoice();
    hostSpeakingRef.current = false;
    setHostSpeaking(false);
    const cfg = settingsRef.current;
    if (questionNumberRef.current >= cfg.questionCount || remainingRef.current.length === 0) {
      finishGame();
      return;
    }

    const recent = resultsRef.current.map((r) => r.correct);
    let target = adaptiveRef.current;
    if (cfg.difficulty === 'adaptive') {
      target = nextAdaptiveDifficulty(recent, adaptiveRef.current);
      setAdaptiveLevel(target);
      adaptiveRef.current = target;
    } else {
      target = cfg.difficulty === 'easy' ? 'easy' : 'hard';
    }

    const { next, rest } = takeMatching(remainingRef.current, target);
    setRemaining(rest);
    remainingRef.current = rest;
    if (cfg.answerMode === 'turn') {
      const nextTurn = (turnRef.current + 1) % Math.max(playersRef.current.length, 1);
      setTurnIndex(nextTurn);
      turnRef.current = nextTurn;
    }
    openQuestion(next, questionNumberRef.current + 1, cfg.questionCount);
  }, [clearFeedbackTimer, finishGame, openQuestion]);

  continueAfterRoundRef.current = continueAfterRound;

  const rematch = useCallback(() => {
    setPlayers((prev) => prev.map((p) => ({ ...p, score: 0 })));
    setResults([]);
    setLastResult(null);
    setCurrent(null);
    applyPhase('IDLE');
    setScreen('LOBBY');
    const names = playersRef.current.map((p) => p.name).join(', ');
    setLine(hostCopy.lobby(names));
  }, [applyPhase, setLine]);

  const pauseRound = useCallback(() => {
    if (pausedRef.current || lockedRef.current) {
      return;
    }
    pausedFromRef.current = phaseRef.current;
    pausedRef.current = true;
    setPaused(true);
    applyPhase('PAUSED');
    void closePlayerMic();
    setListening(false);
    if (hostSpeakingRef.current) {
      void stopHostVoice();
      hostSpeakingRef.current = false;
      setHostSpeaking(false);
    }
    logEvent('PAUSED');
  }, [applyPhase, logEvent]);

  const resumeRound = useCallback(() => {
    if (!pausedRef.current) {
      return;
    }
    pausedRef.current = false;
    setPaused(false);
    logEvent('RESUMED');
    const from = pausedFromRef.current;
    const question = currentRef.current;
    if (!question) {
      return;
    }
    if (from === 'HOST_SPEAKING' || from === 'QUESTION_DISPLAYED' || from === 'QUESTION_SELECTED') {
      void readQuestion(
        question,
        questionNumberRef.current,
        questionTotalRef.current,
        sessionIdRef.current,
      );
      return;
    }
    applyPhase('LISTENING_FOR_PLAYERS');
    beginListening();
  }, [applyPhase, beginListening, logEvent, readQuestion]);

  const repeatQuestion = useCallback(() => {
    const question = currentRef.current;
    if (!question || lockedRef.current) {
      return;
    }
    logEvent('REPEAT_QUESTION');
    clearAiTimer();
    void closePlayerMic();
    void stopHostVoice();
    setListening(false);
    const live = beginSession(question.question_id);
    void readQuestion(question, questionNumberRef.current, questionTotalRef.current, live);
  }, [beginSession, clearAiTimer, logEvent, readQuestion]);

  const skipQuestion = useCallback(() => {
    if (lockedRef.current && screen !== 'GAME') {
      continueAfterRound();
      return;
    }
    logEvent('SKIP_QUESTION');
    resolveRound({
      player: null,
      choiceIndex: null,
      source: 'skip',
      responseMs: 0,
      timedOut: true,
      sessionId: sessionIdRef.current,
    });
  }, [continueAfterRound, logEvent, resolveRound, screen]);

  const stopHostSpeaking = useCallback(() => {
    if (!hostSpeakingRef.current) {
      return;
    }
    void stopHostVoice();
  }, []);

  const retryHostSpeech = useCallback(() => {
    const question = currentRef.current;
    if (!question) {
      return;
    }
    setTtsFailed(false);
    void readQuestion(
      question,
      questionNumberRef.current,
      questionTotalRef.current,
      sessionIdRef.current,
    );
  }, [readQuestion]);

  const skipToListening = useCallback(() => {
    const question = currentRef.current;
    if (!question || lockedRef.current) {
      return;
    }
    if (phaseRef.current !== 'TTS_ERROR' && phaseRef.current !== 'HOST_STOPPED') {
      return;
    }
    hostSpeakingRef.current = false;
    setHostSpeaking(false);
    setTtsFailed(false);
    logEvent('TTS_FINISHED', 'manual-read');
    unlockListening(sessionIdRef.current, question);
  }, [logEvent, unlockListening]);

  const setClickerWho = useCallback((who: ClickerWho) => {
    setClickerWhoState(who);
    if (who !== 'unknown' && who !== 'ai') {
      logEvent('SPEAKER_IDENTIFIED', who);
    }
  }, [logEvent]);

  const setClickerCorrect = useCallback((value: boolean | null) => {
    setClickerCorrectState(value);
  }, []);

  const confirmClicker = useCallback(() => {
    const pending = pendingAnswerRef.current;
    const who = clickerWho;
    if (!pending || !who || who === 'unknown') {
      return;
    }
    const roster = playersRef.current;
    let player: Player | null = null;
    if (who === 'ai') {
      player = roster.find((p) => p.isAi) ?? { ...AI_PLAYER, score: 0 };
    } else {
      player = roster.find((p) => p.id === who) ?? null;
    }
    if (!player) {
      return;
    }
    if (pending.suggestedPlayerId && pending.suggestedPlayerId !== player.id) {
      logEvent('SPEAKER_CORRECTED', `${pending.suggestedPlayerId} → ${player.id}`);
    }
    resolveRound({
      player,
      choiceIndex: pending.choiceIndex,
      source: who === 'ai' ? 'ai' : 'clicker',
      responseMs: pending.responseMs,
      timedOut: false,
      correctOverride: clickerCorrect ?? undefined,
      sessionId: sessionIdRef.current,
    });
  }, [clickerCorrect, clickerWho, logEvent, resolveRound]);

  const logSpeakerCorrection = useCallback(
    (fromId: string | null, toId: string) => {
      logEvent('SPEAKER_CORRECTED', `${fromId ?? 'unknown'} → ${toId}`);
    },
    [logEvent],
  );

  const logTranscriptCorrection = useCallback(
    (fromText: string, toText: string) => {
      logEvent('TRANSCRIPT_CORRECTED', `${fromText} → ${toText}`);
    },
    [logEvent],
  );

  useEffect(() => {
    if (
      screen !== 'GAME' ||
      phase !== 'LISTENING_FOR_PLAYERS' ||
      locked ||
      paused ||
      whoSaidThat ||
      clickerOpen ||
      !timerArmedRef.current
    ) {
      return;
    }
    const id = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          resolveRound({
            player: null,
            choiceIndex: null,
            source: 'timeout',
            responseMs: settingsRef.current.timerSeconds * 1000,
            timedOut: true,
            sessionId: sessionIdRef.current,
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [clickerOpen, locked, paused, phase, resolveRound, screen, whoSaidThat, questionNumber]);

  useEffect(
    () => () => {
      clearAiTimer();
      clearFeedbackTimer();
      void closePlayerMic();
    },
    [clearAiTimer, clearFeedbackTimer],
  );

  const value = useMemo<GameContextValue>(
    () => ({
      screen,
      players,
      settings,
      leaderboard,
      voice,
      hostLine,
      transcript,
      listening,
      current,
      questionNumber,
      questionTotal: settings.questionCount,
      timeLeft,
      locked,
      isBoss,
      multiplier,
      buzzedPlayerId,
      turnPlayerId,
      whoSaidThat,
      lastResult,
      results,
      hydrated,
      phase,
      banner,
      sessionId,
      hostSpeaking,
      pendingAnswer,
      clickerOpen,
      clickerWho,
      clickerCorrect,
      paused,
      canAdvance,
      eventLog,
      ttsFailed,
      interruptAlert,
      goHome,
      goSetup,
      applyQuickMode,
      setPlayerName,
      setPlayerEmoji,
      addPlayer,
      removePlayer,
      loadFamily,
      patchSettings,
      continueToVoiceCheck,
      voiceProfiles,
      completeVoiceEnrollment,
      skipPlayerVoice,
      skipVoiceAndLobby,
      finishVoiceCheck,
      startMatch,
      submitAnswer,
      tapChoice,
      buzzIn,
      claimAnswer,
      continueAfterRound,
      rematch,
      listenNow,
      pauseRound,
      resumeRound,
      repeatQuestion,
      skipQuestion,
      stopHostSpeaking,
      retryHostSpeech,
      skipToListening,
      setClickerWho,
      setClickerCorrect,
      confirmClicker,
      logSpeakerCorrection,
      logTranscriptCorrection,
    }),
    [
      addPlayer,
      applyQuickMode,
      banner,
      buzzIn,
      buzzedPlayerId,
      canAdvance,
      claimAnswer,
      clickerCorrect,
      clickerOpen,
      clickerWho,
      confirmClicker,
      continueAfterRound,
      completeVoiceEnrollment,
      continueToVoiceCheck,
      current,
      eventLog,
      finishVoiceCheck,
      goHome,
      goSetup,
      hostLine,
      hostSpeaking,
      hydrated,
      interruptAlert,
      isBoss,
      lastResult,
      leaderboard,
      listening,
      listenNow,
      loadFamily,
      locked,
      logSpeakerCorrection,
      logTranscriptCorrection,
      multiplier,
      patchSettings,
      pauseRound,
      paused,
      pendingAnswer,
      phase,
      players,
      questionNumber,
      rematch,
      removePlayer,
      repeatQuestion,
      results,
      resumeRound,
      retryHostSpeech,
      sessionId,
      setClickerCorrect,
      setClickerWho,
      setPlayerEmoji,
      setPlayerName,
      settings,
      skipPlayerVoice,
      skipQuestion,
      skipToListening,
      skipVoiceAndLobby,
      startMatch,
      stopHostSpeaking,
      submitAnswer,
      tapChoice,
      timeLeft,
      transcript,
      ttsFailed,
      turnPlayerId,
      voice,
      voiceProfiles,
      whoSaidThat,
      screen,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('useGame must be used inside GameProvider');
  }
  return ctx;
}
