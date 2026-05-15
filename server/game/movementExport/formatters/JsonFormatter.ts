import type { IExportMetadata, IGameMovement } from '../MovementTypes';
import type { IMovementFormatter } from './IMovementFormatter';

/**
 * ECMA-404 / RFC 8259-compliant JSON formatter for `IGameMovement` rows.
 *
 * Layout:
 *   {
 *       "gameId": "...",
 *       "exportedAt": "...",
 *       "totalMovementCount": N,
 *       "movements": [ <movement1>, <movement2>, ... ]
 *   }
 *
 * Implementation notes:
 *   1. Every value that originates from caller-supplied data (`gameId`,
 *      `exportedAt`, individual movement fields) is serialized via the host
 *      `JSON.stringify` so unicode, control characters, double quotes, and
 *      backslashes are escaped exactly the way `JSON.parse` expects. The
 *      output therefore round-trips through `JSON.parse` for any input that
 *      can be represented as a JavaScript string.
 *   2. The prefix and suffix are emitted as separate chunks and individual
 *      movements are stringified one at a time so the orchestrator can stream
 *      arbitrarily large logs to the HTTP response without buffering the
 *      whole payload in memory.
 *   3. The formatter is pure and stateless: no `fs`, no logging, no I/O, and
 *      no state retained between calls.
 */
export class JsonFormatter implements IMovementFormatter {
    public readonly contentType = 'application/json; charset=utf-8';
    public readonly fileExtension = 'json';

    /**
     * Yield the JSON document one chunk at a time. The first chunk contains
     * the opening object plus the metadata fields and the opening `[` of the
     * `movements` array; subsequent chunks contain a single stringified
     * movement (prefixed with `,` for every element after the first); the
     * final chunk closes the array and the object with `]}`.
     */
    public *format(movements: IGameMovement[], metadata: IExportMetadata): Generator<string> {
        // The metadata values are run through `JSON.stringify` so any quote,
        // backslash, or control character in `gameId` / `exportedAt` is
        // escaped the way `JSON.parse` expects. `totalMovementCount` is a
        // number so it is emitted directly via the same call.
        yield (
            '{' +
            `"gameId":${JSON.stringify(metadata.gameId)},` +
            `"exportedAt":${JSON.stringify(metadata.exportedAt)},` +
            `"totalMovementCount":${JSON.stringify(metadata.totalMovementCount)},` +
            '"movements":['
        );

        // Emit each movement as its own chunk. The leading separator on every
        // element after the first keeps the array syntactically valid without
        // requiring a trailing-comma trim at the end.
        for (let i = 0; i < movements.length; i++) {
            const separator = i === 0 ? '' : ',';
            yield separator + JSON.stringify(movements[i]);
        }

        yield ']}';
    }
}
