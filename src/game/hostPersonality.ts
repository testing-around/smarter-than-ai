import type { HostPersonality } from '../types';

export type { HostPersonality };

const recentByBucket = new Map<string, string[]>();

export function pickAvoidingRecent(bucket: string, pool: string[], keep = 8): string {
  const recent = recentByBucket.get(bucket) ?? [];
  const fresh = pool.filter((line) => !recent.includes(line));
  const choices = fresh.length ? fresh : pool;
  const line = choices[Math.floor(Math.random() * choices.length)] ?? pool[0] ?? '';
  const next = [...recent, line].slice(-keep);
  recentByBucket.set(bucket, next);
  return line;
}

export function resetPersonalityHistory(): void {
  recentByBucket.clear();
}

function named(name: string): string {
  return name.trim() || 'that player';
}

const CORRECT: Record<HostPersonality, (name: string, answer: string) => string[]> = {
  CHILL: (name, answer) => [
    `${named(name)} got it.`,
    `Nice, ${named(name)}. ${answer} is right.`,
    `${named(name)} said ${answer}. That's correct.`,
    `Yes — ${named(name)} nailed it.`,
  ],
  FUNNY: (name, answer) => [
    `${named(name)} said ${answer} and the AI just blinked.`,
    `${named(name)} got it! Someone hide the robot's report card.`,
    `Boom — ${named(name)} with ${answer}. Chef's kiss.`,
    `${named(name)} just made that look easy.`,
    `Correct! ${named(name)} is cooking.`,
    `${named(name)} said ${answer}. The host is impressed.`,
  ],
  COMPETITIVE: (name, answer) => [
    `${named(name)} takes it with ${answer}!`,
    `Point to ${named(name)}. Keep the pressure on.`,
    `${named(name)} scores. Who is chasing?`,
    `${named(name)} said ${answer} — that's a strike.`,
  ],
  SASSY: (name, answer) => [
    `${named(name)} said ${answer}. Look who came to play.`,
    `Oh, ${named(name)} knew that one. Cute.`,
    `${named(name)} got it. Don't get comfortable.`,
    `Correct, ${named(name)}. The rest of you, stretch.`,
  ],
  SAVAGE: (name, answer) => [
    `${named(name)} said ${answer} and left no survivors.`,
    `${named(name)} just dunked on the field.`,
    `That's a wipe. ${named(name)} is not playing around.`,
    `${named(name)} got it. Everyone else, take notes.`,
  ],
};

const WRONG: Record<HostPersonality, (name: string, heard: string) => string[]> = [
  'CHILL',
  'FUNNY',
  'COMPETITIVE',
  'SASSY',
  'SAVAGE',
].reduce(
  (acc, level) => {
    const personality = level as HostPersonality;
    acc[personality] = (name: string, heard: string) => {
      const who = named(name);
      const bit = heard.trim() ? ` ${heard} is not it.` : '';
      const base = [
        `Not this time, ${who}.${bit} Still live.`,
        `${who} missed.${bit} Question stays open.`,
        `${who} said that, but no. Keep shouting.`,
      ];
      const extra: Record<HostPersonality, string[]> = {
        CHILL: [`Close, ${who}. Try another angle.`],
        FUNNY: [`${who} swung and the ball is still in the air.`, `${who} just invented a new wrong answer.`],
        COMPETITIVE: [`${who} is locked out if lockout is on. Next hunter.`],
        SASSY: [`${who}, that was brave. Also wrong.`],
        SAVAGE: [`${who} donated that point to the room.`],
      };
      return [...base, ...(extra[personality] ?? [])];
    };
    return acc;
  },
  {} as Record<HostPersonality, (name: string, heard: string) => string[]>,
);

export function hostCorrectLine(
  personality: HostPersonality,
  name: string,
  answer: string,
): string {
  const pool = CORRECT[personality] ?? CORRECT.FUNNY;
  return pickAvoidingRecent(`ok:${personality}`, pool(name, answer), 8);
}

export function hostWrongReaction(
  personality: HostPersonality,
  name: string,
  heard = '',
): string {
  const pool = WRONG[personality] ?? WRONG.FUNNY;
  return pickAvoidingRecent(`no:${personality}`, pool(name, heard), 8);
}

export function hostTieLine(names: string, score: number): string {
  return pickAvoidingRecent(
    'tie',
    [
      `It's a tie at ${score} between ${names}. Sudden death!`,
      `${names} are tied. Only they can answer now.`,
      `Deadlock at ${score}. ${names}, this is yours to lose.`,
    ],
    5,
  );
}
