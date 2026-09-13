import AsyncStorage from '@react-native-async-storage/async-storage';
import { canMarkVoiceReady } from '../game/enrollmentMachine';
import type { VoiceProfile } from '../types';

const PROFILES_KEY = '@sta/voice-profiles';

export async function loadVoiceProfiles(): Promise<VoiceProfile[]> {
  try {
    const raw = await AsyncStorage.getItem(PROFILES_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as VoiceProfile[];
    return parsed.filter((profile) => profile.playerId && Array.isArray(profile.enrollmentSamples));
  } catch {
    return [];
  }
}

export async function saveVoiceProfiles(profiles: VoiceProfile[]): Promise<void> {
  const local = profiles.map((profile) => ({
    ...profile,
    enrollmentSamples: profile.enrollmentSamples.map((sample) => ({
      ...sample,
      audioUri: sample.audioUri,
    })),
  }));
  await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(local));
}

export function upsertProfile(profiles: VoiceProfile[], next: VoiceProfile): VoiceProfile[] {
  return [...profiles.filter((profile) => profile.playerId !== next.playerId), next];
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
