import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cosineSimilarity, extractBandEmbedding, parseWavPcm } from './audioFeatures';

function sine(freq: number, seconds = 1.6, sampleRate = 16000): Float32Array {
  const samples = new Float32Array(Math.round(sampleRate * seconds));
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = 0.35 * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return samples;
}

function encodeWav(samples: Float32Array, sampleRate = 16000): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      bytes[offset + i] = text.charCodeAt(i);
    }
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i += 1) {
    view.setInt16(44 + i * 2, Math.round((samples[i] ?? 0) * 32767), true);
  }
  return bytes;
}

describe('audio features', () => {
  it('parses PCM16 WAV and builds a unit embedding', () => {
    const wav = encodeWav(sine(220));
    const pcm = parseWavPcm(wav);
    assert.ok(pcm);
    const embedding = extractBandEmbedding(pcm);
    assert.equal(embedding.vector.length, 20);
    const mag = Math.sqrt(embedding.vector.reduce((sum, value) => sum + value * value, 0));
    assert.ok(Math.abs(mag - 1) < 0.02);
    assert.equal(embedding.speechDetected, true);
  });

  it('matches similar tones more than distant ones', () => {
    const a = extractBandEmbedding({ sampleRate: 16000, samples: sine(180) });
    const b = extractBandEmbedding({ sampleRate: 16000, samples: sine(190) });
    const c = extractBandEmbedding({ sampleRate: 16000, samples: sine(1400) });
    assert.ok(cosineSimilarity(a.vector, b.vector) > cosineSimilarity(a.vector, c.vector));
  });
});
