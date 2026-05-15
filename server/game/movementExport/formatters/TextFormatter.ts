import type { IExportMetadata, IGameMovement } from '../MovementTypes';
import type { IMovementFormatter } from './IMovementFormatter';

/**
 * Line terminator for the plain-text export. A single LF is used so the
 * output matches the convention demonstrated in the design doc and so each
 * movement occupies exactly one line in any line-oriented viewer (cat, less,
 * `split('\n')`, etc.).
 */
const LineTerminator = '\n';

/**
 * Plain-text formatter for `IGameMovement` rows.
 *
 * Layout:
 *   1. A three-line metadata header recording `gameId`, `exportedAt`, and
 *      `totalMovementCount`. Each header line is prefixed with `# ` so it
 *      stands out from the movement lines and can be skipped by simple
 *      line-oriented parsers.
 *   2. One line per movement formatted as
 *      `[<timestamp>] <player>: <action> - <details>`.
 *
 * Implementation notes:
 *   1. Embedded `\r` and `\n` characters in any field are replaced with the
 *      literal two-character escapes `\r` / `\n` (a backslash followed by
 *      `r` or `n`). This guarantees every movement remains on a single
 *      line so consumers that split on `\n` recover exactly one record per
 *      line regardless of the original payload.
 *   2. The formatter is pure and stateless: it performs no I/O, holds no
 *      state between calls, and yields its output as a `Generator<string>`
 *      so the orchestrator can stream chunks straight to an HTTP response
 *      without buffering the entire payload in memory.
 */
export class TextFormatter implements IMovementFormatter {
    public readonly contentType = 'text/plain; charset=utf-8';
    public readonly fileExtension = 'txt';

    /**
     * Yield the plain-text document one chunk at a time. The first three
     * chunks contain the metadata header lines; subsequent chunks each
     * contain a single formatted movement line. Every chunk already
     * includes its trailing `\n` so chunks can be concatenated as-is.
     */
    public *format(movements: IGameMovement[], metadata: IExportMetadata): Generator<string> {
        // Metadata header: constant labels followed by the caller-supplied
        // values. The values themselves are sanitized so any embedded
        // newline does not break the single-line-per-record invariant.
        yield `# gameId: ${TextFormatter.escapeLineBreaks(metadata.gameId)}${LineTerminator}`;
        yield `# exportedAt: ${TextFormatter.escapeLineBreaks(metadata.exportedAt)}${LineTerminator}`;
        yield `# totalMovementCount: ${metadata.totalMovementCount}${LineTerminator}`;

        // Movement rows: each field is sanitized so embedded carriage
        // returns and line feeds become the literal escapes `\r` / `\n`.
        // The fields are then joined with the canonical separators
        // documented in the design.
        for (const movement of movements) {
            yield (
                '[' + TextFormatter.escapeLineBreaks(movement.timestamp) + '] ' +
                TextFormatter.escapeLineBreaks(movement.player) + ': ' +
                TextFormatter.escapeLineBreaks(movement.action) + ' - ' +
                TextFormatter.escapeLineBreaks(movement.details) +
                LineTerminator
            );
        }
    }

    /**
     * Replace embedded `\r` and `\n` with the literal two-character
     * sequences `\r` / `\n` so the field can be emitted on a single line.
     * No other characters are altered: the design contract is that the
     * single-line-per-record invariant holds, not that the field be fully
     * round-trippable through a generic unescaper.
     */
    private static escapeLineBreaks(field: string): string {
        return field
            .replace(/\r/g, '\\r')
            .replace(/\n/g, '\\n');
    }
}
