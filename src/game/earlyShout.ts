import type { GameSettings } from '../types';

/**
 * Early shout-out is an opt-in on shout-out mode.
 * Default P2 (mic off until TTS done) stays off unless this setting is on.
 * Voice listen still requires `voiceEnabled` at the listening gate.
 */
export function isEarlyShoutArmed(
  settings: Pick<GameSettings, 'earlyShoutOut' | 'answerMode'>,
): boolean {
  return Boolean(settings.earlyShoutOut && settings.answerMode === 'shout');
}
