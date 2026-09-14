/** Official product name. THEN is intentional, not THAN. */
export const APP_NAME = 'Smarter Then AI';
export const APP_NAME_SHORT = 'SMARTER THEN AI';
export const APP_TAGLINE = 'Are you Smarter Then AI?';
export const APP_PACKAGE_ID = 'com.smarterthanai.game';

export const BRAND = {
  name: APP_NAME,
  short: APP_NAME_SHORT,
  tagline: APP_TAGLINE,
  winnerTitle: `${APP_NAME_SHORT} CHAMPION`,
} as const;

export function brandWelcome(): string {
  return `Welcome to ${APP_NAME}. Enter your names and get ready to shout.`;
}

export function brandEnrollmentLine(name: string): string {
  const who = name.trim() || 'Player';
  return `My name is ${who} and I am ready to play ${APP_NAME}`;
}
