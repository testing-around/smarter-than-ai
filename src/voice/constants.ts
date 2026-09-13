/** TTS must finish, then we wait this long before opening the mic. */
export const TTS_MIC_BUFFER_MS = 350;

export const MIN_SAMPLE_MS = 1200;
export const MAX_SAMPLE_MS = 8000;
export const MIN_TRANSCRIPT_CHARS = 4;

export const MIN_VALID_SAMPLES = 3;
export const PREFERRED_SAMPLES = 5;

/** Public auto-assign floor. Calibrated confidence, never raw cosine. */
export const SPEAKER_AUTO_THRESHOLD = 0.7;

/** Embedding match: logistic score + top1−top2 margin. */
export const SPEAKER_CALIBRATED_AUTO = 0.72;
export const SPEAKER_MARGIN_AUTO = 0.1;
export const SPEAKER_COSINE_MIN = 0.35;

export const EMBEDDING_MODEL = 'sta-bands-v1';
export const EMBEDDING_DIM = 20;

export const VOICE_STACK = {
  expoSpeechRecognition: '^57.0.0',
  expoSpeech: '~57.0.3',
  embeddingModel: EMBEDDING_MODEL,
  onnxSpeaker: 'stub',
} as const;
