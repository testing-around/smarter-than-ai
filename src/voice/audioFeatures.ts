import { EMBEDDING_DIM, EMBEDDING_MODEL } from './constants';

const BAND_HZ = [250, 500, 750, 1000, 1500, 2000, 3000, 4000];
const FRAME_MS = 25;
const HOP_MS = 10;

export interface PcmAudio {
  sampleRate: number;
  samples: Float32Array;
}

export interface EmbeddingResult {
  model: typeof EMBEDDING_MODEL;
  vector: number[];
  speechDetected: boolean;
  durationMs: number;
  meanEnergy: number;
}

export function parseWavPcm(bytes: Uint8Array): PcmAudio | null {
  if (bytes.length < 44) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riff = String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0, bytes[2] ?? 0, bytes[3] ?? 0);
  const wave = String.fromCharCode(bytes[8] ?? 0, bytes[9] ?? 0, bytes[10] ?? 0, bytes[11] ?? 0);
  if (riff !== 'RIFF' || wave !== 'WAVE') {
    return null;
  }

  let offset = 12;
  let channels = 1;
  let sampleRate = 16000;
  let bits = 16;
  let dataOffset = -1;
  let dataBytes = 0;

  while (offset + 8 <= bytes.length) {
    const id = String.fromCharCode(
      bytes[offset] ?? 0,
      bytes[offset + 1] ?? 0,
      bytes[offset + 2] ?? 0,
      bytes[offset + 3] ?? 0,
    );
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ' && size >= 16) {
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bits = view.getUint16(body + 14, true);
    } else if (id === 'data') {
      dataOffset = body;
      dataBytes = size;
      break;
    }
    offset = body + size + (size % 2);
  }

  if (dataOffset < 0 || bits !== 16) {
    return null;
  }

  const frameCount = Math.floor(dataBytes / 2 / Math.max(channels, 1));
  const samples = new Float32Array(frameCount);
  for (let i = 0; i < frameCount; i += 1) {
    let mixed = 0;
    for (let ch = 0; ch < channels; ch += 1) {
      mixed += view.getInt16(dataOffset + (i * channels + ch) * 2, true) / 32768;
    }
    samples[i] = mixed / channels;
  }
  return { sampleRate, samples };
}

function goertzelPower(frame: Float32Array, sampleRate: number, freq: number): number {
  const n = frame.length;
  if (n < 8) {
    return 0;
  }
  const k = Math.round((n * freq) / sampleRate);
  const w = (2 * Math.PI * k) / n;
  const coeff = 2 * Math.cos(w);
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < n; i += 1) {
    s0 = (frame[i] ?? 0) + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
  return Math.max(power, 0);
}

function l2normalize(values: number[]): number[] {
  const mag = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (mag < 1e-8) {
    return values.map(() => 0);
  }
  return values.map((value) => value / mag);
}

export function extractBandEmbedding(audio: PcmAudio): EmbeddingResult {
  const { sampleRate, samples } = audio;
  const frameSize = Math.max(8, Math.round((sampleRate * FRAME_MS) / 1000));
  const hop = Math.max(4, Math.round((sampleRate * HOP_MS) / 1000));
  const bandMeans = BAND_HZ.map(() => 0);
  const bandSq = BAND_HZ.map(() => 0);
  let energySum = 0;
  let energySq = 0;
  let zcrSum = 0;
  let zcrSq = 0;
  let frames = 0;

  for (let start = 0; start + frameSize <= samples.length; start += hop) {
    const frame = samples.subarray(start, start + frameSize);
    let energy = 0;
    let zc = 0;
    let prev = frame[0] ?? 0;
    for (let i = 0; i < frame.length; i += 1) {
      const x = frame[i] ?? 0;
      energy += x * x;
      if ((prev >= 0 && x < 0) || (prev < 0 && x >= 0)) {
        zc += 1;
      }
      prev = x;
    }
    const logEnergy = Math.log10(energy / frame.length + 1e-8);
    const zcr = zc / frame.length;
    energySum += logEnergy;
    energySq += logEnergy * logEnergy;
    zcrSum += zcr;
    zcrSq += zcr * zcr;
    for (let b = 0; b < BAND_HZ.length; b += 1) {
      const power = Math.log10(goertzelPower(frame, sampleRate, BAND_HZ[b] ?? 0) + 1e-8);
      bandMeans[b] = (bandMeans[b] ?? 0) + power;
      bandSq[b] = (bandSq[b] ?? 0) + power * power;
    }
    frames += 1;
  }

  const durationMs = (samples.length / Math.max(sampleRate, 1)) * 1000;
  if (frames === 0) {
    return {
      model: EMBEDDING_MODEL,
      vector: Array.from({ length: EMBEDDING_DIM }, () => 0),
      speechDetected: false,
      durationMs,
      meanEnergy: -8,
    };
  }

  const meanEnergy = energySum / frames;
  const stdEnergy = Math.sqrt(Math.max(0, energySq / frames - meanEnergy * meanEnergy));
  const meanZcr = zcrSum / frames;
  const stdZcr = Math.sqrt(Math.max(0, zcrSq / frames - meanZcr * meanZcr));
  const means = bandMeans.map((sum) => sum / frames);
  const stds = bandMeans.map((sum, i) => {
    const mean = sum / frames;
    return Math.sqrt(Math.max(0, (bandSq[i] ?? 0) / frames - mean * mean));
  });

  const vector = l2normalize([...means, ...stds, meanEnergy, stdEnergy, meanZcr, stdZcr]);
  const speechDetected = meanEnergy > -3.4 && meanZcr > 0.01 && meanZcr < 0.45 && durationMs >= 400;

  return {
    model: EMBEDDING_MODEL,
    vector,
    speechDetected,
    durationMs,
    meanEnergy,
  };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    magA += x * x;
    magB += y * y;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom < 1e-8) {
    return 0;
  }
  return Math.max(-1, Math.min(1, dot / denom));
}

export function meanEmbedding(vectors: number[][]): number[] | null {
  const first = vectors[0];
  if (!first || first.length === 0) {
    return null;
  }
  const acc = first.map(() => 0);
  let count = 0;
  for (const vector of vectors) {
    if (vector.length !== acc.length) {
      continue;
    }
    for (let i = 0; i < acc.length; i += 1) {
      acc[i] = (acc[i] ?? 0) + (vector[i] ?? 0);
    }
    count += 1;
  }
  if (count === 0) {
    return null;
  }
  return l2normalize(acc.map((value) => value / count));
}
