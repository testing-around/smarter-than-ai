import { normalizeEnrollment } from '../game/enrollmentMachine';
import type { Player, SpeakerGuess, VoiceProfile } from '../types';

export const SPEAKER_AUTO_THRESHOLD = 0.7;

function tokens(text: string): string[] {
  return normalizeEnrollment(text).split(' ').filter(Boolean);
}

function nameInTranscript(transcript: string, name: string): boolean {
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

function durationScore(durationMs: number, profile: VoiceProfile): number {
  if (!profile.meanDurationMs || durationMs <= 0) {
    return 0;
  }
  const delta = Math.abs(durationMs - profile.meanDurationMs);
  const ratio = 1 - Math.min(1, delta / Math.max(profile.meanDurationMs, 400));
  return ratio * 0.35;
}

/**
 * Best-effort on-device speaker guess. Name-then-answer plus enrolled
 * timing features — not a biometric embedding. Confidence stays below
 * the auto-assign threshold unless a name is heard.
 */
export function guessSpeaker(
  transcript: string,
  durationMs: number,
  players: Player[],
  profiles: VoiceProfile[],
): SpeakerGuess {
  const humans = players.filter((player) => !player.isAi);
  const named = humans.filter((player) => nameInTranscript(transcript, player.name));

  if (named.length >= 2) {
    return { playerId: null, confidence: 0.2, method: 'none' };
  }

  if (named.length === 1 && named[0]) {
    const player = named[0];
    const profile = profiles.find((item) => item.playerId === player.id);
    const ready = Boolean(profile?.quality.voiceReady);
    const timing = profile ? durationScore(durationMs, profile) : 0;
    if (ready) {
      const confidence = Math.min(0.96, 0.82 + timing);
      return {
        playerId: player.id,
        confidence,
        method: timing > 0.08 ? 'combined' : 'name',
      };
    }
    return { playerId: player.id, confidence: 0.62, method: 'name' };
  }

  const ranked = profiles
    .filter((profile) => profile.quality.voiceReady)
    .map((profile) => ({
      playerId: profile.playerId,
      score: durationScore(durationMs, profile),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const second = ranked[1];
  if (best && best.score >= 0.2 && (!second || best.score - second.score >= 0.08)) {
    return {
      playerId: best.playerId,
      confidence: Math.min(0.58, 0.4 + best.score),
      method: 'profile',
    };
  }

  return { playerId: null, confidence: 0, method: 'none' };
}

export function shouldAskWhoSaidThat(guess: SpeakerGuess): boolean {
  return !guess.playerId || guess.confidence < SPEAKER_AUTO_THRESHOLD;
}
