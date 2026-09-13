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
import { AI_PLAYER, FAMILY_PLAYERS, createPlayer } from '../data/players';
import { CATEGORY_LABEL } from '../data/questions';
import {
  nextAdaptiveDifficulty,
  pickDeck,
  takeMatching,
} from '../services/questionBank';
import { scoreForAnswer } from '../services/scoring';
import { parseSpokenAnswer } from '../services/speechParser';
import {
  DEFAULT_SETTINGS,
  loadPersisted,
  mergeLeaderboard,
  saveLeaderboard,
  savePlayers,
  saveSettings,
} from '../services/storage';
import { hostCopy, hostSay, stopHostVoice } from '../services/tts';
import { checkVoiceAvailable, startListening, stopListening } from '../services/voice';
import type {
  AnswerMode,
  AnswerSource,
  GameDifficulty,
  GameSettings,
  LeaderboardRow,
  Player,
  Question,
  QuestionDifficulty,
  QuickModeId,
  RoundResult,
  ScreenName,
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
  },
  lightning: {
    questionCount: 5,
    answerMode: 'shout',
    difficulty: 'easy',
    timerSeconds: 8,
    beatTheAi: false,
  },
  beatAi: {
    questionCount: 10,
    answerMode: 'shout',
    difficulty: 'adaptive',
    timerSeconds: 15,
    beatTheAi: true,
  },
  grade: {
    questionCount: 10,
    answerMode: 'turn',
    difficulty: 'hard',
    timerSeconds: 20,
    beatTheAi: false,
  },
};

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
  enrollPlayer: (id: string) => void;
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

  const playersRef = useRef(players);
  const settingsRef = useRef(settings);
  const currentRef = useRef(current);
  const lockedRef = useRef(locked);
  const startedAtRef = useRef(Date.now());
  const buzzedRef = useRef<string | null>(null);
  const turnRef = useRef(0);
  const whoRef = useRef<WhoSaidThat | null>(null);
  const resultsRef = useRef<RoundResult[]>([]);
  const remainingRef = useRef<Question[]>([]);
  const questionNumberRef = useRef(0);
  const adaptiveRef = useRef<QuestionDifficulty>('medium');
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingClaimRef = useRef<{ choiceIndex: number; responseMs: number } | null>(
    null,
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

  const turnPlayerId = players[turnIndex % Math.max(players.length, 1)]?.id ?? null;
  const multiplier = isBoss ? 3 : 1;

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
      const voiceStatus = await checkVoiceAvailable();
      if (cancelled) {
        return;
      }
      setPlayers(saved.players);
      setSettings(saved.settings);
      setLeaderboard(saved.leaderboard);
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

  const goHome = useCallback(() => {
    clearAiTimer();
    void stopListening();
    void stopHostVoice();
    setScreen('HOME');
    setLocked(false);
    setCurrent(null);
    setWhoSaidThat(null);
    setTranscript('');
    setListening(false);
    setLine(hostCopy.welcome, false);
  }, [clearAiTimer, setLine]);

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
  }, []);

  const continueToVoiceCheck = useCallback(() => {
    const roster = withAi(playersRef.current, settingsRef.current.beatTheAi).map((p) => ({
      ...p,
      name: p.name.trim() || 'Player',
      score: 0,
      enrolled: Boolean(p.isAi),
    }));
    setPlayers(roster);
    void persistRoster(roster, settingsRef.current);
    setScreen('VOICE_CHECK');
    setLine('Each human should enroll. Say your name. If the mic fails, mark it by tap.');
  }, [persistRoster, setLine]);

  const enrollPlayer = useCallback((id: string) => {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, enrolled: true } : p)));
  }, []);

  const skipVoiceAndLobby = useCallback(() => {
    setSettings((prev) => ({ ...prev, voiceEnabled: false }));
    setScreen('LOBBY');
    const names = playersRef.current.map((p) => p.name).join(', ');
    setLine(hostCopy.lobby(names));
  }, [setLine]);

  const finishVoiceCheck = useCallback(() => {
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
    }) => {
      const question = currentRef.current;
      if (!question || lockedRef.current) {
        return;
      }
      lockedRef.current = true;
      setLocked(true);
      clearAiTimer();
      void stopListening();
      setListening(false);
      setWhoSaidThat(null);

      const correct =
        input.choiceIndex !== null && input.choiceIndex === question.correctIndex;
      const points = scoreForAnswer(correct, input.responseMs, isBoss ? 3 : 1);
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
        isBoss,
      };

      if (input.player && points > 0) {
        setPlayers((prev) =>
          prev.map((p) => (p.id === input.player?.id ? { ...p, score: p.score + points } : p)),
        );
      }

      setLastResult(result);
      setResults((prev) => [...prev, result]);
      setScreen('ROUND_RESULT');

      if (input.timedOut) {
        setLine(hostCopy.timeout);
      } else if (input.player && correct) {
        setLine(hostCopy.correct(input.player.name));
      } else if (input.player) {
        setLine(hostCopy.wrong(input.player.name));
      } else {
        setLine(hostCopy.timeout);
      }
    },
    [clearAiTimer, isBoss, setLine],
  );

  const submitAnswer = useCallback(
    (playerId: string, choiceIndex: number, source: AnswerSource) => {
      if (lockedRef.current || whoRef.current) {
        return;
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

      resolveRound({
        player,
        choiceIndex,
        source,
        responseMs: Date.now() - startedAtRef.current,
        timedOut: false,
      });
    },
    [resolveRound],
  );

  const openWhoSaidThat = useCallback(
    (choiceIndex: number, heard: string) => {
      if (lockedRef.current || whoRef.current) {
        return;
      }
      pendingClaimRef.current = {
        choiceIndex,
        responseMs: Date.now() - startedAtRef.current,
      };
      setWhoSaidThat({ transcript: heard, choiceIndex });
      void stopListening();
      setListening(false);
      clearAiTimer();
      setLine(hostCopy.who);
    },
    [clearAiTimer, setLine],
  );

  const tapChoice = useCallback(
    (choiceIndex: number) => {
      if (lockedRef.current || whoRef.current) {
        return;
      }
      const cfg = settingsRef.current;
      const roster = playersRef.current;
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
    [openWhoSaidThat, submitAnswer],
  );

  const handleTranscript = useCallback(
    (text: string, isFinal: boolean) => {
      setTranscript(text);
      if (lockedRef.current || whoRef.current) {
        return;
      }
      const question = currentRef.current;
      if (!question) {
        return;
      }
      const parsed = parseSpokenAnswer(text, playersRef.current, question.choices);
      if (parsed.choiceIndex === null) {
        return;
      }

      const cfg = settingsRef.current;
      const roster = playersRef.current;

      if (parsed.playerId) {
        if (cfg.answerMode === 'turn') {
          const currentTurn = roster[turnRef.current % roster.length];
          if (currentTurn && currentTurn.id !== parsed.playerId) {
            return;
          }
        }
        submitAnswer(parsed.playerId, parsed.choiceIndex, 'voice');
        return;
      }

      if (cfg.answerMode === 'turn') {
        const currentTurn = roster[turnRef.current % roster.length];
        if (currentTurn && !currentTurn.isAi) {
          submitAnswer(currentTurn.id, parsed.choiceIndex, 'voice');
        }
        return;
      }

      if (cfg.answerMode === 'buzz' && buzzedRef.current) {
        submitAnswer(buzzedRef.current, parsed.choiceIndex, 'voice');
        return;
      }

      if (isFinal || parsed.confidence === 'low') {
        openWhoSaidThat(parsed.choiceIndex, text);
      }
    },
    [openWhoSaidThat, submitAnswer],
  );

  const beginListening = useCallback(() => {
    const cfg = settingsRef.current;
    if (!cfg.voiceEnabled || !voice.available) {
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
    ];
    void startListening(phrases, {
      onStart: () => setListening(true),
      onEnd: () => setListening(false),
      onPartial: (text) => handleTranscript(text, false),
      onFinal: (text) => handleTranscript(text, true),
      onError: () => setListening(false),
    });
  }, [handleTranscript, voice.available]);

  const listenNow = useCallback(() => {
    beginListening();
  }, [beginListening]);

  const scheduleAi = useCallback(
    (question: Question, mode: AnswerMode) => {
      clearAiTimer();
      const roster = playersRef.current;
      const bot = roster.find((p) => p.isAi);
      if (!bot || !settingsRef.current.beatTheAi) {
        return;
      }
      aiTimerRef.current = setTimeout(() => {
        if (lockedRef.current || whoRef.current) {
          return;
        }
        if (mode === 'turn') {
          const currentTurn = roster[turnRef.current % roster.length];
          if (currentTurn?.id !== bot.id) {
            return;
          }
        }
        const hits = Math.random() < aiAccuracy(settingsRef.current.difficulty);
        const wrongPool = [0, 1, 2, 3].filter((i) => i !== question.correctIndex);
        const pick = hits
          ? question.correctIndex
          : (wrongPool[Math.floor(Math.random() * wrongPool.length)] ?? 0);
        submitAnswer(bot.id, pick, 'ai');
      }, aiDelayMs(settingsRef.current.timerSeconds));
    },
    [clearAiTimer, submitAnswer],
  );

  const openQuestion = useCallback(
    (question: Question, number: number, total: number) => {
      const boss = number === total;
      lockedRef.current = false;
      setLocked(false);
      setCurrent(question);
      setQuestionNumber(number);
      setIsBoss(boss);
      setTimeLeft(settingsRef.current.timerSeconds);
      setBuzzedPlayerId(null);
      buzzedRef.current = null;
      setWhoSaidThat(null);
      setTranscript('');
      startedAtRef.current = Date.now();
      setScreen('GAME');

      const line = boss
        ? hostCopy.boss
        : hostCopy.question(number, CATEGORY_LABEL[question.category]);
      setLine(line);
      beginListening();
      scheduleAi(question, settingsRef.current.answerMode);
    },
    [beginListening, scheduleAi, setLine],
  );

  const startMatch = useCallback(() => {
    const cfg = settingsRef.current;
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
    openQuestion(next, 1, cfg.questionCount);
  }, [openQuestion]);

  const buzzIn = useCallback((playerId: string) => {
    if (lockedRef.current || buzzedRef.current) {
      return;
    }
    buzzedRef.current = playerId;
    setBuzzedPlayerId(playerId);
    beginListening();
  }, [beginListening]);

  const claimAnswer = useCallback(
    (playerId: string) => {
      const pending = pendingClaimRef.current;
      const player = playersRef.current.find((p) => p.id === playerId);
      if (!pending || !player) {
        return;
      }
      pendingClaimRef.current = null;
      setWhoSaidThat(null);
      resolveRound({
        player,
        choiceIndex: pending.choiceIndex,
        source: 'claim',
        responseMs: pending.responseMs,
        timedOut: false,
      });
    },
    [resolveRound],
  );

  const finishGame = useCallback(() => {
    const roster = [...playersRef.current].sort((a, b) => b.score - a.score);
    const nextBoard = mergeLeaderboard(leaderboard, roster);
    setLeaderboard(nextBoard);
    void saveLeaderboard(nextBoard);
    setScreen('FINAL');
    const champ = roster[0];
    setLine(champ ? hostCopy.winner(champ.name) : hostCopy.timeout);
  }, [leaderboard, setLine]);

  const continueAfterRound = useCallback(() => {
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
  }, [finishGame, openQuestion]);

  const rematch = useCallback(() => {
    setPlayers((prev) => prev.map((p) => ({ ...p, score: 0 })));
    setResults([]);
    setLastResult(null);
    setCurrent(null);
    setScreen('LOBBY');
    const names = playersRef.current.map((p) => p.name).join(', ');
    setLine(hostCopy.lobby(names));
  }, [setLine]);

  useEffect(() => {
    if (screen !== 'GAME' || locked || whoSaidThat) {
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
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [locked, resolveRound, screen, whoSaidThat, questionNumber]);

  useEffect(
    () => () => {
      clearAiTimer();
      void stopListening();
    },
    [clearAiTimer],
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
      enrollPlayer,
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
    }),
    [
      addPlayer,
      applyQuickMode,
      buzzIn,
      buzzedPlayerId,
      claimAnswer,
      continueAfterRound,
      continueToVoiceCheck,
      current,
      enrollPlayer,
      finishVoiceCheck,
      goHome,
      goSetup,
      hydrated,
      hostLine,
      isBoss,
      lastResult,
      leaderboard,
      listening,
      listenNow,
      loadFamily,
      locked,
      multiplier,
      patchSettings,
      players,
      questionNumber,
      rematch,
      removePlayer,
      results,
      setPlayerEmoji,
      setPlayerName,
      settings,
      skipVoiceAndLobby,
      startMatch,
      submitAnswer,
      tapChoice,
      timeLeft,
      transcript,
      turnPlayerId,
      voice,
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

