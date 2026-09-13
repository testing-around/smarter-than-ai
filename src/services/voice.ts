import type { ExpoSpeechRecognitionOptions } from 'expo-speech-recognition';

export interface VoiceListeners {
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (message: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
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
  );

  const options: ExpoSpeechRecognitionOptions = {
    lang: 'en-US',
    interimResults: true,
    continuous: true,
    addsPunctuation: false,
    contextualStrings: contextualStrings.slice(0, 40),
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
