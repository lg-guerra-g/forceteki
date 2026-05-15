import type { IExportMetadata, IGameMovement } from '../MovementTypes';
import type { IMovementFormatter } from './IMovementFormatter';

/**
 * RFC 4180 row terminator. Every row emitted by the CSV formatter ends with
 * CRLF so the output is byte-for-byte conformant with the standard regardless
 * of host operating system.
 */
const RowTerminator = '\r\n';

/**
 * RFC 4180-compliant CSV formatter for `IGameMovement` rows.
 *
 * Layout:
 *   1. Three `metadata,*,<value>,` rows recording `gameId`, `exportedAt`, and
 *      `totalMovementCount`. The trailing comma denotes an empty fourth
 *      column so every row in the document has the same column count.
 *   2. The header row `timestamp,player,action,details`.
 *   3. One row per movement with each field wrapped in `"` and any internal
 *      `"` doubled. Embedded `,`, `\r`, and `\n` are preserved inside the
 *      quoted field so a strict RFC 4180 parser recovers them exactly.
 *
 * The formatter is pure and stateless: it performs no I/O, holds no state
 * between calls, and yields its output as a `Generator<string>` so the
 * orchestrator can stream chunks straight to an HTTP response without
 * buffering the entire payload in memory.
 */
export class CsvFormatter implements IMovementFormatter {
    public readonly contentType = 'text/csv; charset=utf-8';
    public readonly fileExtension = 'csv';

    /**
     * Yield the CSV document one row at a time. Each yielded chunk already
     * includes its CRLF terminator so chunks can be concatenated as-is.
     */
    public *format(movements: IGameMovement[], metadata: IExportMetadata): Generator<string> {
        // Metadata rows: constant labels are emitted literally; the value cell
        // is RFC 4180-quoted so commas, quotes, or newlines in `gameId` round
        // trip through a strict parser. The trailing comma keeps the column
        // count at four to match the header and movement rows.
        yield `metadata,gameId,${CsvFormatter.quote(metadata.gameId)},${RowTerminator}`;
        yield `metadata,exportedAt,${CsvFormatter.quote(metadata.exportedAt)},${RowTerminator}`;
        yield `metadata,totalMovementCount,${CsvFormatter.quote(String(metadata.totalMovementCount))},${RowTerminator}`;

        // Header row: known-safe ASCII identifiers, no quoting required.
        yield `timestamp,player,action,details${RowTerminator}`;

        // Movement rows: every field is wrapped in `"` per the RFC 4180
        // quoting rule. The fields may contain commas, double quotes, CR, LF,
        // tabs, or unicode and must all survive the round trip unchanged.
        for (const movement of movements) {
            yield (
                CsvFormatter.quote(movement.timestamp) + ',' +
                CsvFormatter.quote(movement.player) + ',' +
                CsvFormatter.quote(movement.action) + ',' +
                CsvFormatter.quote(movement.details) +
                RowTerminator
            );
        }
    }

    /**
     * Apply RFC 4180 §2 quoting: wrap the field in double quotes and escape
     * any internal `"` by doubling it. Embedded commas, carriage returns, and
     * line feeds are preserved verbatim inside the quoted field so a strict
     * parser recovers them exactly.
     */
    private static quote(field: string): string {
        return `"${field.replace(/"/g, '""')}"`;
    }
}
