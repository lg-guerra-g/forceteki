import type { IExportMetadata, IGameMovement } from '../MovementTypes';

/**
 * Contract implemented by every concrete movement formatter (CSV, JSON, plain
 * text). A formatter is a pure transformation from a list of normalized
 * movements plus export metadata into a stream of string chunks suitable for
 * piping straight to an HTTP response.
 *
 * The `format` method MUST return a synchronous `Iterable<string>` so the
 * `MovementExporter` can iterate chunks and write them to the response one at
 * a time without buffering the entire payload in memory.
 */
export interface IMovementFormatter {
    // MIME type to set on the `Content-Type` response header (e.g. `text/csv; charset=utf-8`).
    readonly contentType: string;

    // File extension used in the `Content-Disposition` filename (e.g. `csv`, `json`, `txt`).
    readonly fileExtension: string;

    /**
     * Produce the formatted export body as an iterable of string chunks.
     * Each chunk is emitted in order and concatenated to form the final
     * response body. Implementations must be pure and must not perform any
     * I/O of their own.
     */
    format(movements: IGameMovement[], metadata: IExportMetadata): Iterable<string>;
}
