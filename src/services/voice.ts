import type { ExpoSpeechRecognitionOptions } from 'expo-speech-recognition';

export interface VoiceListeners {
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (message: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onAudio?: (uri: string | null) => void;
}

export interface ListenOptions {
  persistRecording?: boolean;
  continuous?: boolean;
}

export interface EnrollmentCapture {
  ok: boolean;
  transcript: string;
  durationMs: number;
  audioUri: string | null;
  error: string | null;
}

export interface VoiceCapability {
  available: boolean;
  detail: string;
}

type SpeechModule = typeof import('expo-speech-recognition');

let speechMod: SpeechModule | null | undefined;
const subscriptions: { remove: () => void }[] = [];

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

export async function checkVoiceAvailable(): Promise<VoiceCapability> {
  try {
    const mod = await loadSpeech();
    if (!mod) {
      return {
        available: false,
        detail: 'Speech module is not in this JavaScript bundle.',
      };
    }
    const available = mod.ExpoSpeechRecognitionModule.isRecognitionAvailable();
    if (!available) {
      return {
        available: false,
        detail:
          'Speech recognition is not available here (browser/engine limitation). Tap answers still work.',
      };
    }
    return {
      available: true,
      detail:
        'Using expo-speech-recognition (iOS SFSpeechRecognizer, Android SpeechRecognizer, or Web Speech API).',
    };
  } catch {
    return {
      available: false,
      detail:
        'Native speech is missing from this build (classic Expo Go). Use a dev client, or play tap-only.',
    };
  }
}

export async function requestVoicePermissions(): Promise<boolean> {
  try {
    const mod = await loadSpeech();
    if (!mod) {
      return false;
    }
    const result = await mod.ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return Boolean(result.granted);
  } catch {
    return false;
  }
}

export async function startListening(
  contextualStrings: string[],
  listeners: VoiceListeners,
  extras: ListenOptions = {},
): Promise<boolean> {
  const mod = await loadSpeech();
  if (!mod) {
    listeners.onError?.('Speech recognition is not available in this build.');
    return false;
  }

  const granted = await requestVoicePermissions();
  if (!granted) {
    listeners.onError?.('Microphone or speech permission was denied.');
    return false;
  }

  await stopListening();
  clearSubscriptions();

  subscriptions.push(
    mod.ExpoSpeechRecognitionModule.addListener('start', () => listeners.onStart?.()),
    mod.ExpoSpeechRecognitionModule.addListener('end', () => listeners.onEnd?.()),
    mod.ExpoSpeechRecognitionModule.addListener('error', (event) => {
      listeners.onError?.(event.message || event.error || 'Speech error');
    }),
    mod.ExpoSpeechRecognitionModule.addListener('result', (event) => {
      const text = event.results?.[0]?.transcript ?? '';
      if (!text) {
        return;
      }
      if (event.isFinal) {
        listeners.onFinal?.(text);
      } else {
        listeners.onPartial?.(text);
      }
    }),
    mod.ExpoSpeechRecognitionModule.addListener('audioend', (event) => {
      listeners.onAudio?.(event.uri ?? null);
    }),
  );

  const options: ExpoSpeechRecognitionOptions = {
    lang: 'en-US',
    interimResults: true,
    continuous: extras.continuous ?? true,
    addsPunctuation: false,
    contextualStrings: contextualStrings.slice(0, 40),
    recordingOptions: extras.persistRecording ? { persist: true } : undefined,
  };

  try {
    mod.ExpoSpeechRecognitionModule.start(options);
    return true;
  } catch (error) {
    listeners.onError?.(error instanceof Error ? error.message : 'Could not start listening');
    return false;
  }
}

export async function stopListening(): Promise<void> {
  try {
    const mod = await loadSpeech();
    if (!mod) {
      return;
    }
    mod.ExpoSpeechRecognitionModule.abort();
  } catch {
    // Already stopped or unavailable.
  }
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
        void stopListening();
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
        void stopListening();
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

/** One enrollment utterance: STT + optional persisted wav (Android/iOS APK). */
export async function captureEnrollmentSample(
  contextualStrings: string[],
  timeoutMs = 10000,
): Promise<EnrollmentCapture> {
  const permitted = await requestVoicePermissions();
  if (!permitted) {
    return {
      ok: false,
      transcript: '',
      durationMs: 0,
      audioUri: null,
      error: 'Microphone or speech permission was denied. Enable it, then retry.',
    };
  }

  return new Promise((resolve) => {
    let settled = false;
    let transcript = '';
    let audioUri: string | null = null;
    const startedAt = Date.now();

    const finish = (error: string | null) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      void stopListening();
      const durationMs = Date.now() - startedAt;
      const heard = transcript.trim();
      resolve({
        ok: Boolean(heard) && !error,
        transcript: heard,
        durationMs,
        audioUri,
        error,
      });
    };

    const timer = setTimeout(() => {
      finish(transcript.trim() ? null : 'Did not catch that phrase. Try again closer to the phone.');
    }, timeoutMs);

    void startListening(
      contextualStrings,
      {
        onFinal: (text) => {
          transcript = text;
          finish(null);
        },
        onPartial: (text) => {
          transcript = text;
        },
        onAudio: (uri) => {
          audioUri = uri;
        },
        onError: (message) => {
          finish(message || 'Speech recognition failed.');
        },
      },
      { persistRecording: true, continuous: false },
    ).then((ok) => {
      if (!ok && !settled) {
        finish('Could not start the microphone.');
      }
    });
  });
}
