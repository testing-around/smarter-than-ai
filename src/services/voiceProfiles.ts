import AsyncStorage from '@react-native-async-storage/async-storage';
import { canMarkVoiceReady } from '../game/enrollmentMachine';
import type { VoiceProfile } from '../types';

const PROFILES_KEY = '@sta/voice-profiles';

function hydrateProfile(profile: VoiceProfile): VoiceProfile | null {
  if (!profile.playerId || !Array.isArray(profile.enrollmentSamples)) {
    return null;
  }
  const embeddings =
    profile.embeddings ??
    profile.enrollmentSamples
      .map((sample) => sample.embedding)
      .filter((item): item is number[] => Array.isArray(item));
  return {
    ...profile,
    embeddings,
    centroid: profile.centroid ?? null,
    embeddingModel: profile.embeddingModel ?? null,
    samplesAccepted: profile.samplesAccepted ?? profile.quality?.phrasesPassed ?? 0,
    locale: profile.locale ?? 'en-US',
    offlineReady: Boolean(profile.offlineReady && embeddings.length >= 3),
    enrollmentSamples: profile.enrollmentSamples.map((sample) => ({
      ...sample,
      audioUri: null,
    })),
  };
}

export async function loadVoiceProfiles(): Promise<VoiceProfile[]> {
  try {
    const raw = await AsyncStorage.getItem(PROFILES_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as VoiceProfile[];
    return parsed.map(hydrateProfile).filter((profile): profile is VoiceProfile => Boolean(profile));
  } catch {
    return [];
  }
}

export async function saveVoiceProfiles(profiles: VoiceProfile[]): Promise<void> {
  const local = profiles.map((profile) => ({
    ...profile,
    enrollmentSamples: profile.enrollmentSamples.map((sample) => ({
      ...sample,
      audioUri: null,
    })),
  }));
  await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(local));
}

export function upsertProfile(profiles: VoiceProfile[], next: VoiceProfile): VoiceProfile[] {
  return [...profiles.filter((profile) => profile.playerId !== next.playerId), next];
}

export function removeProfile(profiles: VoiceProfile[], playerId: string): VoiceProfile[] {
  return profiles.filter((profile) => profile.playerId !== playerId);
}

export function profileForPlayer(
  profiles: VoiceProfile[],
  playerId: string,
): VoiceProfile | null {
  return profiles.find((profile) => profile.playerId === playerId) ?? null;
}

export function playerIsVoiceReady(profiles: VoiceProfile[], playerId: string): boolean {
  return canMarkVoiceReady(profileForPlayer(profiles, playerId));
}
