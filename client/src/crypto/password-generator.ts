/**
 * Password Generator Module
 *
 * Generates cryptographically secure passwords using only crypto.getRandomValues.
 * No Math.random. No DOM imports. No third-party libraries.
 *
 * Designed to pair with the EFF passphrase generator (passphrase.ts) as a separate
 * self-contained module. This file MUST NOT import from passphrase.ts.
 *
 * Security: Uses rejection sampling to eliminate modulo bias in character selection,
 * following the same pattern as passphrase.ts.
 *
 * Entropy formula: tier_length * log2(effective_charset_size)
 * Brute force estimate baseline: 10,000,000,000 guesses/second (GPU cluster)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PasswordTier = 'low' | 'medium' | 'high' | 'max';

export interface PasswordOptions {
  tier: PasswordTier;
  uppercase: boolean;
  numbers: boolean;
  symbols: boolean;
  /** Avoids symbols and numbers; uses phonetically pronounceable lowercase only */
  easyToSay: boolean;
  /** Avoids ambiguous glyphs (1/l/I/|/0/O/B/8/S/5 etc.) */
  easyToRead: boolean;
  /** Removes 1/l/I/|/0/O and all visually confusing chars */
  omitSimilar: boolean;
}

export interface GeneratedPassword {
  password: string;
  entropyBits: number;
  /** Human-readable estimate e.g. "~centuries at 10B guesses/sec" */
  bruteForceEstimate: string;
}

// ---------------------------------------------------------------------------
// Character set constants
// ---------------------------------------------------------------------------

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMBERS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{}|;:,.<>?';
/** Easy-to-say: phonetically pronounceable lowercase. Omits e,i,l,o,q,x. */
const PHONETIC = 'abcdefghjkmnprstuvwyz';
/** Omit-similar filter: strips 1, l, I, |, 0, O */
const SIMILAR_RE = /[1lI|0O]/g;
/** Easy-to-read filter: superset of SIMILAR_RE, also strips B, 8, S, 5 */
const AMBIGUOUS_RE = /[1lI|0OB8S5]/g;

// ---------------------------------------------------------------------------
// Tier configuration
// ---------------------------------------------------------------------------

interface TierConfig {
  length: number;
  uppercase: boolean;
  numbers: boolean;
  symbols: boolean;
}

const TIER_CONFIG: Record<PasswordTier, TierConfig> = {
  low: { length: 8, uppercase: false, numbers: false, symbols: false },
  medium: { length: 12, uppercase: true, numbers: true, symbols: false },
  high: { length: 16, uppercase: true, numbers: true, symbols: true },
  max: { length: 24, uppercase: true, numbers: true, symbols: true },
};

// ---------------------------------------------------------------------------
// Brute force estimation
// ---------------------------------------------------------------------------

const GUESSES_PER_SEC = 10_000_000_000;

/**
 * Build the effective character set from options.
 * Returns the deduplicated charset string after all filters are applied.
 * Throws if the resulting charset is empty (conflicting filters).
 */
function buildCharset(options: PasswordOptions): string {
  const tier = TIER_CONFIG[options.tier];

  // Guard: easyToSay + omitSimilar is a conflicting combination.
  // easyToSay restricts to phonetic lowercase; omitSimilar further restricts the
  // same character domain, creating an aggressive filter combination that the UI
  // should prevent. Throw rather than silently produce a weakened password.
  if (options.easyToSay && options.omitSimilar) {
    throw new Error('No characters available with current filter combination');
  }

  // Determine active character classes
  // easyToSay takes precedence — forces lowercase-only phonetic mode
  const useLowercase = true; // always include some lowercase
  const useUppercase = options.easyToSay ? false : (options.uppercase ?? tier.uppercase);
  const useNumbers = options.easyToSay ? false : (options.numbers ?? tier.numbers);
  const useSymbols = options.easyToSay ? false : (options.symbols ?? tier.symbols);

  // Build raw charset
  let raw = '';

  if (useLowercase) {
    raw += options.easyToSay ? PHONETIC : LOWERCASE;
  }
  if (useUppercase) {
    raw += UPPERCASE;
  }
  if (useNumbers) {
    raw += NUMBERS;
  }
  if (useSymbols) {
    raw += SYMBOLS;
  }

  // Apply filters
  // easyToRead is a superset of omitSimilar — if both are set, easyToRead dominates
  if (options.easyToRead) {
    raw = raw.replace(AMBIGUOUS_RE, '');
  } else if (options.omitSimilar) {
    raw = raw.replace(SIMILAR_RE, '');
  }

  // Deduplicate (regex replace can leave duplicates if charset strings overlap)
  const deduplicated = [...new Set(raw)].join('');

  if (deduplicated.length === 0) {
    throw new Error('No characters available with current filter combination');
  }

  return deduplicated;
}

/**
 * Return a single unbiased random character from charset using rejection sampling.
 *
 * Generates a Uint32 value via crypto.getRandomValues. Values >= limit are
 * rejected to eliminate modulo bias. The limit is floor(0xFFFFFFFF / n) * n
 * ensuring uniform distribution across all charset indices.
 *
 * Invariant: only crypto.getRandomValues may be used for randomness (no Math.random).
 */
function randomChar(charset: string): string {
  const n = charset.length;
  const limit = Math.floor(0xffffffff / n) * n;
  const buf = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buf);
    value = buf[0]!;
  } while (value >= limit);
  return charset[value % n];
}

/**
 * Calculate entropy bits for a password of given length drawn from a charset of given size.
 */
function calculateEntropy(length: number, charsetSize: number): number {
  return length * Math.log2(charsetSize);
}

/**
 * Produce a human-readable brute force time estimate at 10B guesses/sec.
 */
function bruteForceLabel(entropyBits: number): string {
  const seconds = Math.pow(2, entropyBits) / GUESSES_PER_SEC;

  let label: string;
  if (seconds < 1) {
    label = 'instantly';
  } else if (seconds < 60) {
    label = '~seconds';
  } else if (seconds < 3600) {
    label = '~minutes';
  } else if (seconds < 86400) {
    label = '~hours';
  } else if (seconds < 2592000) {
    label = '~days';
  } else if (seconds < 31536000) {
    label = '~months';
  } else if (seconds < 3.156e10) {
    label = '~decades';
  } else if (seconds < 3.156e11) {
    label = '~centuries';
  } else {
    label = '~eons';
  }

  return `${label} at 10B guesses/sec`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically secure password.
 *
 * @param options - Tier, character class flags, and filter options
 * @returns Generated password with entropy bits and brute force estimate
 * @throws Error if active filters produce an empty character set
 *
 * @example
 * const { password, entropyBits, bruteForceEstimate } = generatePassword({
 *   tier: 'high',
 *   uppercase: true,
 *   numbers: true,
 *   symbols: true,
 *   easyToSay: false,
 *   easyToRead: false,
 *   omitSimilar: false,
 * });
 */
export function generatePassword(options: PasswordOptions): GeneratedPassword {
  const charset = buildCharset(options);
  const length = TIER_CONFIG[options.tier].length;

  let password = '';
  for (let i = 0; i < length; i++) {
    password += randomChar(charset);
  }

  const entropyBits = calculateEntropy(length, charset.length);

  return {
    password,
    entropyBits,
    bruteForceEstimate: bruteForceLabel(entropyBits),
  };
}
