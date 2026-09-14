import { brandEnrollmentLine } from '../branding';
import { enrollmentPhrases, phrasePassed, scorePhraseMatch } from '../game/enrollmentMachine';
import type { Player } from '../types';

export type ParseConfidence = 'high' | 'medium' | 'low' | 'none';

export interface ParsedSpeech {
  playerId: string | null;
  matchedName: string | null;
  choiceIndex: number | null;
  confidence: ParseConfidence;
}

const LETTER_WORDS: Record<string, number> = {
  a: 0,
  ay: 0,
  aye: 0,
  eh: 0,
  alpha: 0,
  b: 1,
  bee: 1,
  be: 1,
  bravo: 1,
  c: 2,
  see: 2,
  sea: 2,
  charlie: 2,
  d: 3,
  dee: 3,
  delta: 3,
  one: 0,
  two: 1,
  three: 2,
  four: 3,
  first: 0,
  second: 1,
  third: 2,
  fourth: 3,
};

const NUMBER_WORDS: Record<string, string> = {
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  fifty: '50',
  hundred: '100',
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fold(text: string): string {
  return normalize(text)
    .replace(/^(the|a|an)\s+/, '')
    .replace(/\b(option|letter|answer|choice|number)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text: string): string[] {
  return normalize(text).split(' ').filter(Boolean);
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const grid: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (__, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const prevRow = grid[i - 1];
      const curRow = grid[i];
      if (!prevRow || !curRow) {
        continue;
      }
      curRow[j] = Math.min(
        (prevRow[j] ?? 0) + 1,
        (curRow[j - 1] ?? 0) + 1,
        (prevRow[j - 1] ?? 0) + cost,
      );
    }
  }

  return grid[a.length]?.[b.length] ?? Math.max(a.length, b.length);
}

function matchPlayer(transcript: string, players: Player[]): Player | null {
  const words = tokens(transcript);
  const joined = words.join(' ');
  let best: { player: Player; score: number } | null = null;

  for (const player of players) {
    if (player.isAi) {
      continue;
    }
    const name = normalize(player.name);
    if (!name) {
      continue;
    }
    if (joined.includes(name)) {
      const score = 100 + name.length;
      if (!best || score > best.score) {
        best = { player, score };
      }
      continue;
    }

    const nameParts = name.split(' ');
    for (const part of nameParts) {
      if (part.length < 3) {
        continue;
      }
      for (const word of words) {
        if (word === part || (part.length >= 4 && word.startsWith(part.slice(0, 4)))) {
          const score = 80 + part.length;
          if (!best || score > best.score) {
            best = { player, score };
          }
        } else if (word.length >= 4 && levenshtein(word, part) <= 1) {
          const score = 60 + part.length;
          if (!best || score > best.score) {
            best = { player, score };
          }
        }
      }
    }
  }

  return best?.player ?? null;
}

function matchLetter(transcript: string): number | null {
  const words = tokens(transcript);
  const joined = ` ${words.join(' ')} `;

  const patterned = joined.match(
    /\b(?:option|letter|answer|choice|number)\s+([a-d]|one|two|three|four|alpha|bravo|charlie|delta)\b/,
  );
  if (patterned?.[1]) {
    const mapped = LETTER_WORDS[patterned[1]];
    if (mapped !== undefined) {
      return mapped;
    }
  }

  for (const word of words) {
    if (word in LETTER_WORDS && word.length > 1) {
      const mapped = LETTER_WORDS[word];
      if (mapped !== undefined) {
        return mapped;
      }
    }
  }

  const isolated = words.filter((word) => word.length === 1 && 'abcd'.includes(word));
  if (isolated.length === 1 && isolated[0]) {
    return LETTER_WORDS[isolated[0]] ?? null;
  }

  return null;
}

function expandAliases(text: string): string[] {
  const folded = fold(text);
  const extra = NUMBER_WORDS[folded];
  return extra && extra !== folded ? [folded, extra] : [folded];
}

function matchAccepted(
  transcript: string,
  choices: string[],
  acceptedAnswers: string[],
): number | null {
  const hay = fold(transcript);
  const words = tokens(hay);

  for (const accepted of acceptedAnswers) {
    for (const needle of expandAliases(accepted)) {
      if (needle.length < 1) {
        continue;
      }
      if (hay === needle || hay.includes(needle) || words.includes(needle)) {
        const mapped = indexForAccepted(needle, choices) ?? indexForAccepted(fold(accepted), choices);
        if (mapped !== null) {
          return mapped;
        }
      }

      if (needle.length >= 3) {
        for (const word of words) {
          if (word.length >= 3 && levenshtein(word, needle) <= 1) {
            const mapped = indexForAccepted(needle, choices) ?? indexForAccepted(fold(accepted), choices);
            if (mapped !== null) {
              return mapped;
            }
          }
        }
      }
    }
  }
  return null;
}

function indexForAccepted(needle: string, choices: string[]): number | null {
  const foldedNeedle = fold(needle);
  const exact = choices.findIndex((choice) => fold(choice) === foldedNeedle);
  if (exact >= 0) {
    return exact;
  }
  const via = choices.findIndex((choice) => fold(choice).includes(foldedNeedle));
  return via >= 0 ? via : null;
}

function matchChoiceText(transcript: string, choices: string[]): number | null {
  const hay = fold(transcript);
  let bestIndex: number | null = null;
  let bestLen = 0;

  for (let index = 0; index < choices.length; index += 1) {
    const needle = fold(choices[index] ?? '');
    if (needle.length >= 2 && (hay === needle || hay.includes(needle)) && needle.length > bestLen) {
      bestIndex = index;
      bestLen = needle.length;
      continue;
    }

    const significant = needle.split(' ').filter((word) => word.length >= 5);
    const hits = significant.filter((word) => hay.includes(word)).length;
    if (significant.length > 0 && hits === significant.length) {
      const len = significant.join(' ').length;
      if (len > bestLen) {
        bestIndex = index;
        bestLen = len;
      }
    }
  }

  return bestIndex;
}

export function parseSpokenAnswer(
  transcript: string,
  players: Player[],
  choices: string[],
  acceptedAnswers: string[] = [],
): ParsedSpeech {
  if (!normalize(transcript)) {
    return { playerId: null, matchedName: null, choiceIndex: null, confidence: 'none' };
  }

  const player = matchPlayer(transcript, players);
  const acceptedHit = matchAccepted(transcript, choices, acceptedAnswers);
  const choiceIndex =
    matchLetter(transcript) ?? acceptedHit ?? matchChoiceText(transcript, choices);

  if (choiceIndex === null) {
    return {
      playerId: player?.id ?? null,
      matchedName: player?.name ?? null,
      choiceIndex: null,
      confidence: 'none',
    };
  }

  if (player) {
    return {
      playerId: player.id,
      matchedName: player.name,
      choiceIndex,
      confidence: 'high',
    };
  }

  return {
    playerId: null,
    matchedName: null,
    choiceIndex,
    confidence: 'low',
  };
}

export function enrollmentPhrase(name: string): string {
  return brandEnrollmentLine(name);
}

export function transcriptMatchesEnrollment(transcript: string, name: string): boolean {
  const phrase = enrollmentPhrases(name)[0];
  if (!phrase) {
    return false;
  }
  return phrasePassed(scorePhraseMatch(transcript, phrase, name));
}
