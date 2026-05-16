/*
 * Hand-written generators for the `game-movement-export` feature's property
 * tests. Every generator is a pure function of a `() => number` random source
 * (compatible with `mulberry32`'s output from `./seededRandom`) so the
 * specs can replay any failing seed deterministically.
 *
 * Exports
 * -------
 * - `genMovement(rng)`            -> `IGameMovement` with ISO 8601 timestamp
 * - `genMovements(rng, maxLen?)`  -> `IGameMovement[]` of length 0..maxLen (default 8)
 * - `genMetadata(rng)`            -> `IExportMetadata`
 * - `genSerializedMessage(rng)`   -> `ISerializedMessage` in one of the three
 *                                    normalizer-relevant shapes (alert,
 *                                    player-named array, plain string / mixed array)
 *
 * Special-character vocabulary
 * ----------------------------
 * Per Requirement 7.4 and the design's testing strategy, every string field
 * draws from a vocabulary that explicitly mixes in problematic characters so
 * the formatters and normalizer are exercised against realistic edge cases:
 *
 *   - the empty string                          ('')
 *   - comma                                     (',')
 *   - double quote                              ('"')
 *   - single quote                              ('\'')
 *   - carriage return                           ('\r')
 *   - line feed                                 ('\n')
 *   - tab                                       ('\t')
 *   - backslash                                 ('\\')
 *   - unicode incl. surrogate pair (rocket emoji '\uD83D\uDE80')
 *   - other multi-byte unicode                  ('日本語', 'café')
 *   - mixed strings combining the above         ('foo,bar"baz', 'line1\nline2')
 *
 * Purity
 * ------
 * No `fs`, no I/O, no logging. The module is a pure function of its `rng`
 * argument and the constants below.
 */

import type { ISerializedMessage } from '../../../../server/game/Interfaces';
import type { IExportMetadata, IGameMovement } from '../../../../server/game/movementExport/MovementTypes';

const SPECIAL_TOKENS: readonly string[] = [
    '',
    ',',
    '"',
    '\'',
    '\r',
    '\n',
    '\t',
    '\\',
    '\uD83D\uDE80',
    'a',
    'name with spaces',
    'foo,bar"baz',
    'line1\nline2',
    '日本語',
    'café'
];

const PLAYER_NAMED_TYPES: readonly string[] = ['card', 'player'];

const TIMESTAMP_RANGE_START_MS = Date.UTC(2020, 0, 1);
const TIMESTAMP_RANGE_END_MS = Date.UTC(2030, 0, 1);

function pickInt(rng: () => number, maxExclusive: number): number {
    return Math.floor(rng() * maxExclusive);
}

function pickToken(rng: () => number): string {
    return SPECIAL_TOKENS[pickInt(rng, SPECIAL_TOKENS.length)];
}

/** Build a string by concatenating 0..3 special-character tokens. */
function genString(rng: () => number): string {
    const tokenCount = pickInt(rng, 4);
    let out = '';
    for (let i = 0; i < tokenCount; i++) {
        out += pickToken(rng);
    }
    return out;
}

function genDate(rng: () => number): Date {
    const span = TIMESTAMP_RANGE_END_MS - TIMESTAMP_RANGE_START_MS;
    const ms = TIMESTAMP_RANGE_START_MS + Math.floor(rng() * span);
    return new Date(ms);
}

function genIsoTimestamp(rng: () => number): string {
    return genDate(rng).toISOString();
}

/** Generate a `(string | number)[]` of length 0..4 mixing strings and ints. */
function genMixedArray(rng: () => number): (string | number)[] {
    const len = pickInt(rng, 5);
    const out: (string | number)[] = [];
    for (let i = 0; i < len; i++) {
        if (rng() < 0.7) {
            out.push(genString(rng));
        } else {
            out.push(pickInt(rng, 1000));
        }
    }
    return out;
}

/** Generate a string-only array of length 0..3 (used for alert.message arrays). */
function genStringArray(rng: () => number): string[] {
    const len = pickInt(rng, 4);
    const out: string[] = [];
    for (let i = 0; i < len; i++) {
        out.push(genString(rng));
    }
    return out;
}

/** Generate the plain `MessageText` shape (`string | (string | number)[]`). */
function genMessageText(rng: () => number): string | (string | number)[] {
    if (rng() < 0.5) {
        return genString(rng);
    }
    return genMixedArray(rng);
}

export function genMovement(rng: () => number): IGameMovement {
    return {
        timestamp: genIsoTimestamp(rng),
        player: genString(rng),
        action: genString(rng),
        details: genString(rng)
    };
}

export function genMovements(rng: () => number, maxLen: number = 8): IGameMovement[] {
    // Length 0 must be reachable, so the upper bound is `maxLen + 1` (exclusive).
    const len = pickInt(rng, maxLen + 1);
    const out: IGameMovement[] = [];
    for (let i = 0; i < len; i++) {
        out.push(genMovement(rng));
    }
    return out;
}

export function genMetadata(rng: () => number): IExportMetadata {
    return {
        gameId: genString(rng),
        exportedAt: genIsoTimestamp(rng),
        totalMovementCount: pickInt(rng, 100)
    };
}

/*
 * Generate one of the three `ISerializedMessage` shapes the normalizer
 * recognizes. Each branch is reachable because `pickInt(rng, 3)` covers
 * exactly {0, 1, 2}:
 *
 *   shape 0 -> alert: { alert: { type, message: string | string[] } }
 *   shape 1 -> player-named array: [{ name, id, type }, ...(string | number)[]]
 *   shape 2 -> plain message text: string | (string | number)[]
 *
 * The player-named shape does not strictly conform to `MessageText`; it is
 * the same loose runtime shape that `GameChat` produces and that
 * `MovementNormalizer.normalizeEntry` matches via duck typing. We cast
 * through `unknown` to align with the production normalizer's own cast.
 */
export function genSerializedMessage(rng: () => number): ISerializedMessage {
    const shape = pickInt(rng, 3);
    const date = genDate(rng);

    if (shape === 0) {
        const messageBody = rng() < 0.5 ? genString(rng) : genStringArray(rng);
        return {
            date,
            message: {
                alert: {
                    type: genString(rng),
                    message: messageBody
                }
            }
        };
    }

    if (shape === 1) {
        const first = {
            name: genString(rng),
            id: genString(rng),
            type: PLAYER_NAMED_TYPES[pickInt(rng, PLAYER_NAMED_TYPES.length)]
        };
        const rest = genMixedArray(rng);
        const message: unknown[] = [first, ...rest];
        return {
            date,
            message: message as unknown as ISerializedMessage['message']
        };
    }

    return {
        date,
        message: genMessageText(rng)
    };
}
