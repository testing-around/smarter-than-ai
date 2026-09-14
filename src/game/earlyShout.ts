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

/**
 * Tap-during-TTS. Default ON for shout-out (including Family / Lightning /
 * Beat the AI). Independent of the voice early-shout mic gate.
 */
export function isEarlyTapArmed(
  settings: Pick<GameSettings, 'earlyTapIn' | 'earlyShoutOut' | 'answerMode'>,
): boolean {
  if (settings.answerMode !== 'shout') {
    return false;
  }
  if (settings.earlyTapIn === false) {
    return false;
  }
  return true;
}

/** Buttons / grading may run while the host is still reading. */
export function isEarlyAnswerArmed(
  settings: Pick<GameSettings, 'earlyTapIn' | 'earlyShoutOut' | 'answerMode'>,
): boolean {
  return isEarlyTapArmed(settings) || isEarlyShoutArmed(settings);
}
