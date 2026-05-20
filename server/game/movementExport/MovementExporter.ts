import type { ISerializedMessage } from '../Interfaces';
import type { ExportFormat, IExportMetadata } from './MovementTypes';
import type { IMovementFormatter } from './formatters/IMovementFormatter';
import { MovementNormalizer } from './MovementNormalizer';

/**
 * Thrown when a formatter raises an error during export. The route handler
 * catches this and responds with `500 { error: 'Export formatting failed' }`.
 */
export class MovementFormattingError extends Error {
    public constructor(message: string, public readonly cause?: unknown) {
        super(message);
        this.name = 'MovementFormattingError';
    }
}

/**
 * Orchestrates the export pipeline: normalizes raw `ISerializedMessage`
 * entries into `IGameMovement` rows, selects the appropriate formatter, and
 * either collects the output into a string or streams it chunk-by-chunk to a
 * writable stream.
 *
 * This module intentionally imports no `fs`, `fs/promises`, `path`, or any
 * DynamoDB / persistence module (Requirements 3.2, 3.5, 3.6).
 */
export class MovementExporter {
    public constructor(private readonly formatters: Record<ExportFormat, IMovementFormatter>) {}

    /**
     * Collect all formatter chunks into a single string and return it.
     * Useful for tests and small payloads where buffering is acceptable.
     */
    public exportToString(
        format: ExportFormat,
        metadata: IExportMetadata,
        messages: ISerializedMessage[]
    ): string {
        const movements = MovementNormalizer.normalize(messages);
        const formatter = this.formatters[format];

        let result = '';
        try {
            for (const chunk of formatter.format(movements, metadata)) {
                result += chunk;
            }
        } catch (err) {
            throw new MovementFormattingError(
                `Formatter failed for format "${format}": ${err instanceof Error ? err.message : String(err)}`,
                err
            );
        }

        return result;
    }

    /**
     * Stream formatter chunks directly to `res`, writing each chunk as it is
     * produced and calling `res.end()` when the formatter is exhausted.
     *
     * If the formatter throws at any point the error is wrapped in a
     * `MovementFormattingError` and re-thrown so the route handler can decide
     * whether to respond with 500 or abort an in-flight response.
     */
    public async streamExport(
        format: ExportFormat,
        metadata: IExportMetadata,
        messages: ISerializedMessage[],
        res: NodeJS.WritableStream
    ): Promise<void> {
        const movements = MovementNormalizer.normalize(messages);
        const formatter = this.formatters[format];

        try {
            for (const chunk of formatter.format(movements, metadata)) {
                res.write(chunk);
            }
        } catch (err) {
            throw new MovementFormattingError(
                `Formatter failed for format "${format}": ${err instanceof Error ? err.message : String(err)}`,
                err
            );
        }

        res.end();
    }
}
