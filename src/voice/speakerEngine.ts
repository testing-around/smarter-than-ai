import type { Player, SpeakerGuess, VoiceProfile } from '../types';
import { normalizeEnrollment } from '../game/enrollmentMachine';
import {
  SPEAKER_AUTO_THRESHOLD,
  SPEAKER_CALIBRATED_AUTO,
  SPEAKER_COSINE_MIN,
  SPEAKER_MARGIN_AUTO,
} from './constants';
import { cosineSimilarity, meanEmbedding } from './audioFeatures';

export function calibratedFromCosine(cosine: number): number {
  const logistic = 1 / (1 + Math.exp(-6 * (cosine - 0.25)));
  return Math.max(0, Math.min(1, logistic));
}

function tokens(text: string): string[] {
  return normalizeEnrollment(text).split(' ').filter(Boolean);
}

export function nameInTranscript(transcript: string, name: string): boolean {
  const hay = normalizeEnrollment(transcript);
  const who = normalizeEnrollment(name);
  if (!who || who.length < 2) {
    return false;
  }
  if (hay.includes(who)) {
    return true;
  }
  const first = who.split(' ')[0] ?? '';
  return first.length >= 3 && tokens(transcript).includes(first);
}

export function profileCentroid(profile: VoiceProfile): number[] | null {
  if (profile.centroid && profile.centroid.length) {
    return profile.centroid;
  }
  const vectors = [
    ...(profile.embeddings ?? []),
    ...profile.enrollmentSamples.map((sample) => sample.embedding).filter((item): item is number[] => Boolean(item)),
  ];
  return meanEmbedding(vectors);
}

export function hasOfflineEmbedding(profile: VoiceProfile): boolean {
  return Boolean(profile.offlineReady && profileCentroid(profile));
}

export function matchEmbedding(
  probe: number[],
  profiles: VoiceProfile[],
): { playerId: string; cosine: number; calibrated: number; margin: number } | null {
  const ranked = profiles
    .map((profile) => {
      const centroid = profileCentroid(profile);
      if (!centroid) {
        return null;
      }
      const cosine = cosineSimilarity(probe, centroid);
      return {
        playerId: profile.playerId,
        cosine,
        calibrated: calibratedFromCosine(cosine),
      };
    })
    .filter((row): row is { playerId: string; cosine: number; calibrated: number } => Boolean(row))
    .sort((a, b) => b.cosine - a.cosine);

  const best = ranked[0];
  if (!best) {
    return null;
  }
  const second = ranked[1];
  const margin = second ? best.cosine - second.cosine : 1;
  return { ...best, margin };
}

export function guessSpeaker(
  transcript: string,
  durationMs: number,
  players: Player[],
  profiles: VoiceProfile[],
  probeEmbedding?: number[] | null,
): SpeakerGuess {
  const humans = players.filter((player) => !player.isAi);
  const named = humans.filter((player) => nameInTranscript(transcript, player.name));

  if (named.length >= 2) {
    return {
      playerId: null,
      confidence: 0.2,
      method: 'none',
      ambiguous: true,
      margin: 0,
    };
  }

  const readyProfiles = profiles.filter((profile) => profile.quality.voiceReady);
  const embeddingHit =
    probeEmbedding && probeEmbedding.some((value) => value !== 0)
      ? matchEmbedding(probeEmbedding, readyProfiles)
      : null;

  if (named.length === 1 && named[0]) {
    const player = named[0];
    const profile = profiles.find((item) => item.playerId === player.id);
    if (embeddingHit && embeddingHit.playerId === player.id && !isAmbiguous(embeddingHit)) {
      const confidence = Math.min(0.96, Math.max(embeddingHit.calibrated, 0.82));
      return {
        playerId: player.id,
        confidence,
        method: 'combined',
        cosine: embeddingHit.cosine,
        margin: embeddingHit.margin,
        ambiguous: false,
      };
    }
    if (embeddingHit && embeddingHit.playerId !== player.id) {
      return {
        playerId: null,
        confidence: Math.min(embeddingHit.calibrated, 0.45),
        method: 'none',
        cosine: embeddingHit.cosine,
        margin: embeddingHit.margin,
        ambiguous: true,
      };
    }
    if (profile?.quality.voiceReady) {
      return {
        playerId: player.id,
        confidence: 0.82,
        method: 'name',
        ambiguous: false,
      };
    }
    return {
      playerId: player.id,
      confidence: 0.62,
      method: 'name',
      ambiguous: true,
    };
  }

  if (embeddingHit && !isAmbiguous(embeddingHit)) {
    return {
      playerId: embeddingHit.playerId,
      confidence: embeddingHit.calibrated,
      method: 'embedding',
      cosine: embeddingHit.cosine,
      margin: embeddingHit.margin,
      ambiguous: false,
    };
  }

  if (embeddingHit) {
    return {
      playerId: null,
      confidence: embeddingHit.calibrated,
      method: 'embedding',
      cosine: embeddingHit.cosine,
      margin: embeddingHit.margin,
      ambiguous: true,
    };
  }

  void durationMs;
  return {
    playerId: null,
    confidence: 0,
    method: 'none',
    ambiguous: true,
    margin: 0,
  };
}

export function isAmbiguous(hit: { calibrated: number; cosine: number; margin: number }): boolean {
  return (
    hit.calibrated < SPEAKER_CALIBRATED_AUTO ||
    hit.cosine < SPEAKER_COSINE_MIN ||
    hit.margin < SPEAKER_MARGIN_AUTO
  );
}

export function shouldAskWhoSaidThat(guess: SpeakerGuess): boolean {
  if (!guess.playerId || guess.ambiguous) {
    return true;
  }
  return guess.confidence < SPEAKER_AUTO_THRESHOLD;
}

export { SPEAKER_AUTO_THRESHOLD };
