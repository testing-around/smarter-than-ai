import { extractBandEmbedding, parseWavPcm, type EmbeddingResult } from './audioFeatures';
import { voiceLog } from './voiceLog';

async function readUriBytes(uri: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(uri);
    if (!response.ok) {
      return null;
    }
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (error) {
    voiceLog('embed.read_failed', { uri, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

export async function embedFromRecordingUri(uri: string | null): Promise<EmbeddingResult | null> {
  if (!uri) {
    return null;
  }
  const bytes = await readUriBytes(uri);
  if (!bytes) {
    return null;
  }
  const pcm = parseWavPcm(bytes);
  if (!pcm) {
    voiceLog('embed.parse_failed', { uri, bytes: bytes.length });
    return null;
  }
  const result = extractBandEmbedding(pcm);
  voiceLog('embed.ok', {
    uri,
    durationMs: Math.round(result.durationMs),
    speechDetected: result.speechDetected,
    dim: result.vector.length,
  });
  return result;
}

export async function discardRecording(uri: string | null): Promise<void> {
  if (!uri) {
    return;
  }
  // Raw wav is never written into AsyncStorage. Cache files are left for the OS
  // unless a file-system module is present at runtime.
  voiceLog('embed.raw_audio_dropped', { uri, persisted: false });
}
