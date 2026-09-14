import { Platform } from 'react-native';
import type { ExpoSpeechRecognitionOptions } from 'expo-speech-recognition';
import { TTS_MIC_BUFFER_MS } from '../voice/constants';
import { discardRecording, embedFromRecordingUri } from '../voice/embedRecording';
import { formatVoiceError, mapRecognitionError } from '../voice/mapRecognitionError';
import { recognitionMachine } from '../voice/recognitionSession';
import {
  getVoiceDiagnostics,
  getVoiceUiContext,
  patchVoiceCaps,
  recordVoiceError,
  setVoiceUiContext,
} from '../voice/voiceDiagnostics';
import { voiceLog } from '../voice/voiceLog';
import { hostSay, isHostTtsActive, waitForHostTtsIdle } from './tts';

export interface VoiceErrorMeta {
  errorType: string | null;
  nativeErrorCode: number | null;
  sessionId: number;
}

export interface VoiceListeners {
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (message: string, meta?: VoiceErrorMeta) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onAudio?: (uri: string | null) => void;
}

export interface ListenOptions {
  persistRecording?: boolean;
  continuous?: boolean;
  preferOnDevice?: boolean;
  contextualScreen?: string;
}

export interface EnrollmentCapture {
  ok: boolean;
  transcript: string;
  durationMs: number;
  audioUri: string | null;
  embedding: number[] | null;
  speechDetected: boolean;
  error: string | null;
  errorType: string | null;
}

export interface VoiceCapability {
  available: boolean;
  detail: string;
  onDevice?: boolean;
  recording?: boolean;
  micGranted?: boolean | null;
  recognitionService?: string | null;
  offlineEnUs?: boolean | null;
}

type SpeechModule = typeof import('expo-speech-recognition');

let speechMod: SpeechModule | null | undefined;
const subscriptions: { remove: () => void }[] = [];
let permissionGranted: boolean | null = null;
let startLock: Promise<void> = Promise.resolve();

async function loadSpeech(): Promise<SpeechModule | null> {
  if (speechMod !== undefined) {
    return speechMod;
  }
  try {
    speechMod = await import('expo-speech-recognition');
    return speechMod;
  } catch {
    speechMod = null;
    return null;
  }
}

function clearSubscriptions(): void {
  while (subscriptions.length) {
    subscriptions.pop()?.remove();
  }
}

function syncMachineCaps(): void {
  const snap = recognitionMachine.snapshot();
  patchVoiceCaps({
    recognizerState: snap.state,
    sessionId: snap.sessionId,
    ttsActive: isHostTtsActive(),
  });
}

async function withStartLock<T>(fn: () => Promise<T>): Promise<T> {
  let release: () => void = () => undefined;
  const previous = startLock;
  startLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

export async function probeVoiceCapabilities(): Promise<{
  available: boolean;
  onDevice: boolean;
  recording: boolean;
  recognitionService: string | null;
  assistantService: string | null;
  installedLocales: string[];
  offlineEnUs: boolean;
}> {
  const empty = {
    available: false,
    onDevice: false,
    recording: false,
    recognitionService: null,
    assistantService: null,
    installedLocales: [] as string[],
    offlineEnUs: false,
  };
  const mod = await loadSpeech();
  if (!mod) {
    return empty;
  }
  const native = mod.ExpoSpeechRecognitionModule;
  const available = Boolean(native.isRecognitionAvailable());
  const onDevice = Boolean(native.supportsOnDeviceRecognition?.());
  const recording = Boolean(native.supportsRecording?.());
  const recognitionService =
    Platform.OS === 'android' ? native.getDefaultRecognitionService?.().packageName || null : null;
  const assistantService =
    Platform.OS === 'android' ? native.getAssistantService?.().packageName || null : null;
  let installedLocales: string[] = [];
  try {
    const locales = await native.getSupportedLocales({
      androidRecognitionServicePackage: recognitionService ?? undefined,
    });
    installedLocales = locales.installedLocales ?? [];
  } catch {
    installedLocales = [];
  }
  const offlineEnUs = installedLocales.some((locale) => locale.toLowerCase().startsWith('en'));
  patchVoiceCaps({
    recognitionAvailable: available,
    onDeviceSupported: onDevice,
    recordingSupported: recording,
    recognitionService,
    assistantService,
    installedLocales,
    offlineEnUs,
  });
  return {
    available,
    onDevice,
    recording,
    recognitionService,
    assistantService,
    installedLocales,
    offlineEnUs,
  };
}

export async function checkVoiceAvailable(): Promise<VoiceCapability> {
  try {
    const mod = await loadSpeech();
    if (!mod) {
      return {
        available: false,
        detail: 'Speech module is not in this JavaScript bundle.',
      };
    }
    const caps = await probeVoiceCapabilities();
    if (!caps.available) {
      return {
        available: false,
        detail:
          'Speech recognition is not available here (browser/engine limitation). Tap answers still work.',
        ...capabilityFlags(caps),
      };
    }
    const offline = caps.offlineEnUs
      ? 'On-device English looks installed.'
      : 'On-device English pack not detected — network STT may be required.';
    return {
      available: true,
      detail: `Using expo-speech-recognition. ${offline} Speaker ID is a local profile on this device, not the STT engine.`,
      ...capabilityFlags(caps),
    };
  } catch {
    return {
      available: false,
      detail:
        'Native speech is missing from this build (classic Expo Go). Use a standalone APK, or play tap-only.',
    };
  }
}

function capabilityFlags(caps: Awaited<ReturnType<typeof probeVoiceCapabilities>>): Pick<
  VoiceCapability,
  'onDevice' | 'recording' | 'recognitionService' | 'offlineEnUs'
> {
  return {
    onDevice: caps.onDevice,
    recording: caps.recording,
    recognitionService: caps.recognitionService,
    offlineEnUs: caps.offlineEnUs,
  };
}

export async function getVoicePermissionGranted(): Promise<boolean> {
  try {
    const mod = await loadSpeech();
    if (!mod) {
      return false;
    }
    const current = await mod.ExpoSpeechRecognitionModule.getPermissionsAsync();
    permissionGranted = Boolean(current.granted);
    patchVoiceCaps({ micGranted: permissionGranted });
    return permissionGranted;
  } catch {
    return false;
  }
}

export async function requestVoicePermissions(): Promise<boolean> {
  try {
    const mod = await loadSpeech();
    if (!mod) {
      return false;
    }
    const existing = await mod.ExpoSpeechRecognitionModule.getPermissionsAsync();
    if (existing.granted) {
      permissionGranted = true;
      patchVoiceCaps({ micGranted: true });
      return true;
    }
    const result = await mod.ExpoSpeechRecognitionModule.requestPermissionsAsync();
    permissionGranted = Boolean(result.granted);
    patchVoiceCaps({ micGranted: permissionGranted });
    return permissionGranted;
  } catch {
    permissionGranted = false;
    patchVoiceCaps({ micGranted: false });
    return false;
  }
}

function dumpError(input: {
  errorType: string | null;
  nativeErrorCode: number | null;
  message: string | null;
  requestedAbort: boolean;
}): void {
  const snap = recognitionMachine.snapshot();
  const ui = getVoiceUiContext();
  const dump = recordVoiceError({
    screen: ui.screen,
    playerId: ui.playerId,
    phrase: ui.phrase,
    recognizerState: snap.state,
    sessionId: snap.sessionId,
    errorType: input.errorType,
    nativeErrorCode: input.nativeErrorCode,
    message: input.message,
    micPermission: permissionGranted,
    recognitionService: getVoiceDiagnostics().recognitionService,
    offlineModel: getVoiceDiagnostics().offlineEnUs,
    ttsActive: isHostTtsActive(),
    recordingActive: getVoiceDiagnostics().recordingActive,
    requestedAbort: input.requestedAbort,
  });
  voiceLog('error.dump', { ...dump });
}

function attachListeners(sessionId: number, listeners: VoiceListeners): void {
  const mod = speechMod;
  if (!mod) {
    return;
  }
  clearSubscriptions();
  subscriptions.push(
    mod.ExpoSpeechRecognitionModule.addListener('start', () => {
      if (recognitionMachine.shouldIgnoreCallback(sessionId)) {
        voiceLog('event.start.stale', { sessionId });
        return;
      }
      recognitionMachine.transition(sessionId, 'LISTENING');
      syncMachineCaps();
      patchVoiceCaps({ recordingActive: true });
      voiceLog('event.start', { sessionId, state: recognitionMachine.snapshot().state });
      listeners.onStart?.();
    }),
    mod.ExpoSpeechRecognitionModule.addListener('end', () => {
      if (recognitionMachine.shouldIgnoreCallback(sessionId)) {
        voiceLog('event.end.stale', { sessionId });
        return;
      }
      patchVoiceCaps({ recordingActive: false });
      const snap = recognitionMachine.snapshot();
      if (snap.state === 'PROCESSING' || snap.state === 'SAVING') {
        recognitionMachine.finish(sessionId, 'SUCCESS');
      } else if (snap.state !== 'SUCCESS' && snap.state !== 'ERROR') {
        recognitionMachine.finish(sessionId, snap.abortRequested ? 'ERROR' : 'SUCCESS');
      }
      syncMachineCaps();
      voiceLog('event.end', { sessionId, state: recognitionMachine.snapshot().state });
      listeners.onEnd?.();
    }),
    mod.ExpoSpeechRecognitionModule.addListener('error', (event) => {
      if (recognitionMachine.shouldIgnoreCallback(sessionId)) {
        voiceLog('event.error.stale', { sessionId, error: event.error });
        return;
      }
      const requestedAbort = recognitionMachine.snapshot().abortRequested;
      const errorType = event.error || null;
      const nativeErrorCode = typeof event.code === 'number' ? event.code : null;
      dumpError({
        errorType,
        nativeErrorCode,
        message: event.message || null,
        requestedAbort,
      });
      if (errorType === 'aborted' && !requestedAbort) {
        voiceLog('event.error.unsolicited_abort_ignored', { sessionId, nativeErrorCode });
        return;
      }
      recognitionMachine.finish(sessionId, 'ERROR');
      syncMachineCaps();
      const mapped = mapRecognitionError(errorType, event.message);
      listeners.onError?.(formatVoiceError(mapped), {
        errorType,
        nativeErrorCode,
        sessionId,
      });
    }),
    mod.ExpoSpeechRecognitionModule.addListener('result', (event) => {
      if (recognitionMachine.shouldIgnoreCallback(sessionId)) {
        return;
      }
      const text = event.results?.[0]?.transcript ?? '';
      if (!text) {
        return;
      }
      if (event.isFinal) {
        recognitionMachine.transition(sessionId, 'PROCESSING');
        syncMachineCaps();
        voiceLog('event.result.final', { sessionId, text });
        listeners.onFinal?.(text);
      } else {
        voiceLog('event.result.partial', { sessionId, text });
        listeners.onPartial?.(text);
      }
    }),
    mod.ExpoSpeechRecognitionModule.addListener('audioend', (event) => {
      if (recognitionMachine.shouldIgnoreCallback(sessionId)) {
        return;
      }
      recognitionMachine.transition(sessionId, 'SAVING');
      syncMachineCaps();
      voiceLog('event.audioend', { sessionId, uri: event.uri ?? null });
      listeners.onAudio?.(event.uri ?? null);
    }),
  );
}

async function buildStartOptions(
  contextualStrings: string[],
  extras: ListenOptions,
): Promise<ExpoSpeechRecognitionOptions> {
  const caps = await probeVoiceCapabilities();
  const preferOnDevice = extras.preferOnDevice !== false && caps.onDevice && caps.offlineEnUs;
  const persist = Boolean(extras.persistRecording && caps.recording);
  patchVoiceCaps({ recordingActive: persist });
  const options: ExpoSpeechRecognitionOptions = {
    lang: 'en-US',
    interimResults: true,
    continuous: extras.continuous ?? true,
    addsPunctuation: false,
    contextualStrings: contextualStrings.slice(0, 40),
    requiresOnDeviceRecognition: preferOnDevice,
    recordingOptions: persist ? { persist: true } : undefined,
  };
  if (caps.recognitionService) {
    options.androidRecognitionServicePackage = caps.recognitionService;
  }
  voiceLog('start.options', {
    preferOnDevice,
    persist,
    continuous: options.continuous,
    service: caps.recognitionService,
    offlineEnUs: caps.offlineEnUs,
  });
  return options;
}

export function getRecognizerState() {
  return recognitionMachine.snapshot();
}

export function isRecognizerBusy(): boolean {
  return recognitionMachine.isBusy();
}

export async function startListening(
  contextualStrings: string[],
  listeners: VoiceListeners,
  extras: ListenOptions = {},
): Promise<boolean> {
  return withStartLock(async () => {
    if (extras.contextualScreen) {
      setVoiceUiContext({ screen: extras.contextualScreen });
    }
    const snap = recognitionMachine.snapshot();
    voiceLog('start.requested', {
      state: snap.state,
      sessionId: snap.sessionId,
      ttsActive: isHostTtsActive(),
      busy: recognitionMachine.isBusy(),
    });
    if (recognitionMachine.isBusy()) {
      voiceLog('start.blocked_busy', { state: snap.state, sessionId: snap.sessionId });
      if (snap.state === 'LISTENING' || snap.state === 'PREPARING') {
        return true;
      }
      listeners.onError?.(
        formatVoiceError(mapRecognitionError('busy', 'Recognizer is already running.')),
      );
      return false;
    }

    const sessionId = recognitionMachine.begin();
    if (!sessionId) {
      voiceLog('start.begin_failed', { ...recognitionMachine.snapshot() });
      listeners.onError?.('Could not start a new listening session.');
      return false;
    }
    syncMachineCaps();

    const mod = await loadSpeech();
    if (!mod) {
      recognitionMachine.finish(sessionId, 'ERROR');
      listeners.onError?.('Speech recognition is not available in this build.');
      return false;
    }

    const granted = await requestVoicePermissions();
    if (!granted) {
      recognitionMachine.finish(sessionId, 'ERROR');
      dumpError({
        errorType: 'not-allowed',
        nativeErrorCode: null,
        message: 'permission denied',
        requestedAbort: false,
      });
      listeners.onError?.(
        formatVoiceError(mapRecognitionError('not-allowed', 'Microphone or speech permission was denied.')),
      );
      return false;
    }

    await waitForHostTtsIdle(TTS_MIC_BUFFER_MS);
    if (recognitionMachine.shouldIgnoreCallback(sessionId)) {
      voiceLog('start.stale_after_tts', { sessionId });
      return false;
    }
    if (isHostTtsActive()) {
      recognitionMachine.finish(sessionId, 'ERROR');
      listeners.onError?.(
        formatVoiceError(mapRecognitionError('audio-capture', 'Host is still speaking.')),
      );
      return false;
    }

    attachListeners(sessionId, listeners);
    try {
      const options = await buildStartOptions(contextualStrings, extras);
      voiceLog('start.native', { sessionId, state: recognitionMachine.snapshot().state });
      mod.ExpoSpeechRecognitionModule.start(options);
      return true;
    } catch (error) {
      recognitionMachine.finish(sessionId, 'ERROR');
      syncMachineCaps();
      listeners.onError?.(error instanceof Error ? error.message : 'Could not start listening');
      return false;
    }
  });
}

/** Graceful end — asks for a final result. Never abort(). */
export async function stopListening(): Promise<void> {
  const snap = recognitionMachine.snapshot();
  voiceLog('stop.requested', { state: snap.state, sessionId: snap.sessionId, abortRequested: snap.abortRequested });
  if (snap.state === 'IDLE' || snap.state === 'SUCCESS' || snap.state === 'ERROR') {
    return;
  }
  recognitionMachine.transition(snap.sessionId, 'PROCESSING');
  try {
    const mod = await loadSpeech();
    mod?.ExpoSpeechRecognitionModule.stop();
  } catch {
    // Already stopped or unavailable.
  }
  syncMachineCaps();
}

/** Cancel / stuck recovery only. This is the only path that may call abort(). */
export async function cancelListening(reason = 'cancel'): Promise<void> {
  const snap = recognitionMachine.snapshot();
  voiceLog('abort.requested', { reason, state: snap.state, sessionId: snap.sessionId });
  if (snap.state === 'IDLE' || snap.state === 'SUCCESS' || snap.state === 'ERROR') {
    return;
  }
  recognitionMachine.requestAbort(snap.sessionId);
  try {
    const mod = await loadSpeech();
    mod?.ExpoSpeechRecognitionModule.abort();
  } catch {
    // Already stopped or unavailable.
  }
  recognitionMachine.finish(snap.sessionId, 'ERROR');
  syncMachineCaps();
}

export async function listenOnce(
  contextualStrings: string[],
  timeoutMs = 8000,
): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        void cancelListening('listenOnce-timeout');
        resolve(null);
      }
    }, timeoutMs);

    void startListening(contextualStrings, {
      onFinal: (text) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        void stopListening();
        resolve(text);
      },
      onError: () => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(null);
      },
    }).then((ok) => {
      if (!ok && !settled) {
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    });
  });
}

export async function captureEnrollmentSample(
  contextualStrings: string[],
  timeoutMs = 12000,
  extras: { speakPrompt?: string; screen?: string; playerId?: string; phrase?: string } = {},
): Promise<EnrollmentCapture> {
  setVoiceUiContext({
    screen: extras.screen ?? 'VOICE_CHECK',
    playerId: extras.playerId ?? null,
    phrase: extras.phrase ?? extras.speakPrompt ?? null,
  });

  const permitted = await requestVoicePermissions();
  if (!permitted) {
    return {
      ok: false,
      transcript: '',
      durationMs: 0,
      audioUri: null,
      embedding: null,
      speechDetected: false,
      error: formatVoiceError(mapRecognitionError('not-allowed', 'Microphone or speech permission was denied.')),
      errorType: 'not-allowed',
    };
  }

  if (extras.speakPrompt) {
    await hostSay(extras.speakPrompt);
    await waitForHostTtsIdle(TTS_MIC_BUFFER_MS);
  }

  return new Promise((resolve) => {
    let settled = false;
    let transcript = '';
    let audioUri: string | null = null;
    const startedAt = Date.now();

    const finish = (error: string | null, errorType: string | null = null) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      const durationMs = Date.now() - startedAt;
      const heard = transcript.trim();
      void (async () => {
        if (heard && !error) {
          await stopListening();
        }
        const embedded = await embedFromRecordingUri(audioUri);
        await discardRecording(audioUri);
        resolve({
          ok: Boolean(heard) && !error,
          transcript: heard,
          durationMs: embedded?.durationMs || durationMs,
          audioUri: null,
          embedding: embedded?.vector ?? null,
          speechDetected: embedded?.speechDetected ?? Boolean(heard),
          error,
          errorType,
        });
      })();
    };

    const timer = setTimeout(() => {
      void cancelListening('enrollment-timeout');
      finish(
        heardOrTimeout(transcript),
        transcript.trim() ? null : 'speech-timeout',
      );
    }, timeoutMs);

    void startListening(
      contextualStrings,
      {
        onFinal: (text) => {
          transcript = text;
          setTimeout(() => finish(null), 350);
        },
        onPartial: (text) => {
          transcript = text;
        },
        onAudio: (uri) => {
          audioUri = uri;
        },
        onError: (message, meta) => {
          finish(message || 'Speech recognition failed.', meta?.errorType ?? 'unknown');
        },
      },
      {
        persistRecording: true,
        continuous: false,
        preferOnDevice: true,
        contextualScreen: extras.screen ?? 'VOICE_CHECK',
      },
    ).then((ok) => {
      if (!ok && !settled) {
        finish('Could not start the microphone.', 'start-failed');
      }
    });
  });
}

function heardOrTimeout(transcript: string): string | null {
  return transcript.trim()
    ? null
    : 'Did not catch that phrase. Try again closer to the phone.';
}

export { getVoiceDiagnostics, formatDiagnosticsText } from '../voice/voiceDiagnostics';
export { mapRecognitionError, formatVoiceError } from '../voice/mapRecognitionError';
