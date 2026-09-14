export interface MappedVoiceError {
  code: string;
  title: string;
  message: string;
  recover: Array<'retry' | 'diagnostics' | 'tap-only'>;
}

const FRIENDLY: Record<string, MappedVoiceError> = {
  aborted: {
    code: 'aborted',
    title: 'Listening was interrupted',
    message:
      'Listening stopped before a result. Wait for the host to finish, then try again. This is not a failed voice profile.',
    recover: ['retry', 'diagnostics', 'tap-only'],
  },
  'no-speech': {
    code: 'no-speech',
    title: 'No speech heard',
    message: 'I did not catch any speech. Move closer and say the full line.',
    recover: ['retry', 'tap-only'],
  },
  'speech-timeout': {
    code: 'speech-timeout',
    title: 'No speech heard',
    message: 'The mic closed before it heard a phrase. Try again.',
    recover: ['retry', 'tap-only'],
  },
  'not-allowed': {
    code: 'not-allowed',
    title: 'Microphone permission needed',
    message: 'Allow microphone and speech recognition in system settings, then try again.',
    recover: ['retry', 'diagnostics', 'tap-only'],
  },
  'audio-capture': {
    code: 'audio-capture',
    title: 'Microphone busy',
    message: 'The mic is in use (often the host voice). Wait a moment, then try again.',
    recover: ['retry', 'diagnostics'],
  },
  busy: {
    code: 'busy',
    title: 'Recognizer busy',
    message: 'Speech recognition was already running. Wait, then try again.',
    recover: ['retry', 'diagnostics'],
  },
  network: {
    code: 'network',
    title: 'Offline speech unavailable',
    message:
      'This device needed a network speech service. Install the on-device English pack, or play tap-only.',
    recover: ['retry', 'diagnostics', 'tap-only'],
  },
  'service-not-allowed': {
    code: 'service-not-allowed',
    title: 'Speech service unavailable',
    message: 'The Android speech service is missing or blocked. Try again, or play tap-only.',
    recover: ['retry', 'diagnostics', 'tap-only'],
  },
  'language-not-supported': {
    code: 'language-not-supported',
    title: 'Language pack missing',
    message: 'Install the on-device English (US) speech pack, then try again.',
    recover: ['retry', 'diagnostics', 'tap-only'],
  },
  client: {
    code: 'client',
    title: 'Recognizer reset',
    message: 'The speech engine reset. Wait a beat, then try again.',
    recover: ['retry', 'diagnostics'],
  },
};

export function mapRecognitionError(
  errorType?: string | null,
  message?: string | null,
): MappedVoiceError {
  const code = (errorType || '').toLowerCase();
  const known = FRIENDLY[code];
  if (known) {
    return known;
  }
  const raw = (message || '').trim();
  if (/speech recognition aborted/i.test(raw) || /^aborted$/i.test(raw)) {
    return FRIENDLY.aborted;
  }
  return {
    code: code || 'unknown',
    title: 'Could not listen',
    message: raw && !/speech recognition aborted/i.test(raw)
      ? raw
      : 'Speech recognition failed. Try again, open diagnostics, or continue tap-only.',
    recover: ['retry', 'diagnostics', 'tap-only'],
  };
}

export function formatVoiceError(error: MappedVoiceError): string {
  return `${error.title}. ${error.message}`;
}
