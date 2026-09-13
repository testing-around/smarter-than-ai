import { Platform } from 'react-native';
import { VOICE_STACK } from './constants';
import type { RecognizerState } from './recognitionSession';

export interface VoiceErrorDump {
  ts: string;
  screen: string;
  playerId: string | null;
  phrase: string | null;
  recognizerState: RecognizerState;
  sessionId: number;
  errorType: string | null;
  nativeErrorCode: number | null;
  message: string | null;
  micPermission: boolean | null;
  recognitionService: string | null;
  offlineModel: boolean | null;
  ttsActive: boolean;
  recordingActive: boolean;
  requestedAbort: boolean;
}

export interface VoiceDiagnosticsSnapshot {
  platform: string;
  packageVersions: typeof VOICE_STACK;
  micGranted: boolean | null;
  recognizerState: RecognizerState;
  sessionId: number;
  recognitionAvailable: boolean | null;
  onDeviceSupported: boolean | null;
  recordingSupported: boolean | null;
  recognitionService: string | null;
  assistantService: string | null;
  installedLocales: string[];
  offlineEnUs: boolean | null;
  ttsActive: boolean;
  recordingActive: boolean;
  lastErrors: VoiceErrorDump[];
  embeddingModel: string;
  onnxSpeaker: string;
}

const lastErrors: VoiceErrorDump[] = [];
const MAX_ERRORS = 12;

let context = {
  screen: 'unknown',
  playerId: null as string | null,
  phrase: null as string | null,
};

let caps = {
  micGranted: null as boolean | null,
  recognitionAvailable: null as boolean | null,
  onDeviceSupported: null as boolean | null,
  recordingSupported: null as boolean | null,
  recognitionService: null as string | null,
  assistantService: null as string | null,
  installedLocales: [] as string[],
  offlineEnUs: null as boolean | null,
  ttsActive: false,
  recordingActive: false,
  recognizerState: 'IDLE' as RecognizerState,
  sessionId: 0,
};

export function setVoiceUiContext(next: Partial<typeof context>): void {
  context = { ...context, ...next };
}

export function patchVoiceCaps(next: Partial<typeof caps>): void {
  caps = { ...caps, ...next };
}

export function recordVoiceError(dump: Omit<VoiceErrorDump, 'ts'> & { ts?: string }): VoiceErrorDump {
  const full: VoiceErrorDump = {
    ts: dump.ts ?? new Date().toISOString(),
    ...dump,
  };
  lastErrors.unshift(full);
  if (lastErrors.length > MAX_ERRORS) {
    lastErrors.length = MAX_ERRORS;
  }
  return full;
}

export function getVoiceUiContext(): typeof context {
  return context;
}

export function getVoiceDiagnostics(): VoiceDiagnosticsSnapshot {
  return {
    platform: `${Platform.OS} ${String(Platform.Version)}`,
    packageVersions: VOICE_STACK,
    micGranted: caps.micGranted,
    recognizerState: caps.recognizerState,
    sessionId: caps.sessionId,
    recognitionAvailable: caps.recognitionAvailable,
    onDeviceSupported: caps.onDeviceSupported,
    recordingSupported: caps.recordingSupported,
    recognitionService: caps.recognitionService,
    assistantService: caps.assistantService,
    installedLocales: caps.installedLocales,
    offlineEnUs: caps.offlineEnUs,
    ttsActive: caps.ttsActive,
    recordingActive: caps.recordingActive,
    lastErrors: [...lastErrors],
    embeddingModel: VOICE_STACK.embeddingModel,
    onnxSpeaker: VOICE_STACK.onnxSpeaker,
  };
}

export function formatDiagnosticsText(snap: VoiceDiagnosticsSnapshot = getVoiceDiagnostics()): string {
  return [
    `platform: ${snap.platform}`,
    `expo-speech-recognition: ${snap.packageVersions.expoSpeechRecognition}`,
    `expo-speech: ${snap.packageVersions.expoSpeech}`,
    `embedding: ${snap.embeddingModel} · onnx: ${snap.onnxSpeaker}`,
    `mic: ${snap.micGranted}`,
    `recognizer: ${snap.recognizerState} session=${snap.sessionId}`,
    `available: ${snap.recognitionAvailable} · on-device: ${snap.onDeviceSupported} · recording: ${snap.recordingSupported}`,
    `service: ${snap.recognitionService ?? '—'}`,
    `assistant: ${snap.assistantService ?? '—'}`,
    `offline en-US: ${snap.offlineEnUs} · locales: ${snap.installedLocales.join(', ') || '—'}`,
    `ttsActive: ${snap.ttsActive} · recordingActive: ${snap.recordingActive}`,
    `last errors:`,
    ...(snap.lastErrors.length
      ? snap.lastErrors.slice(0, 5).map(
          (err) =>
            `  ${err.ts} ${err.errorType ?? 'unknown'} native=${err.nativeErrorCode ?? '—'} abortReq=${err.requestedAbort} tts=${err.ttsActive} state=${err.recognizerState} ${err.message ?? ''}`,
        )
      : ['  none']),
  ].join('\n');
}
