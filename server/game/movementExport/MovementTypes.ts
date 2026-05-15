/**
 * Shared types for the Game Movement Export feature.
 *
 * These types are used by the normalizer, formatters, and exporter to flatten
 * the in-memory game movement log into rows suitable for download in CSV,
 * JSON, or plain-text format.
 */

/**
 * A single normalized game movement row, derived from one entry in the
 * `GameChat` message buffer. All fields are strings so they can be emitted
 * uniformly by every formatter; fields without a meaningful value are
 * represented as the empty string rather than `null` or `undefined`.
 */
export interface IGameMovement {
    // ISO 8601 timestamp of when the movement was recorded.
    timestamp: string;

    // Acting player's display name, or empty string for system / alert messages.
    player: string;

    // The action performed; never null.
    action: string;

    // Free-form details about the action; empty string when not applicable.
    details: string;
}

/**
 * Metadata embedded by every formatter so that any export can be traced back
 * to its source game and the moment it was generated.
 */
export interface IExportMetadata {
    // Lobby identifier used by clients and surfaced in download filenames.
    gameId: string;

    // ISO 8601 timestamp captured at the moment the export was produced.
    exportedAt: string;

    // Number of movements included in the export body.
    totalMovementCount: number;
}

// Supported export formats accepted by the export endpoint.
export type ExportFormat = 'csv' | 'json' | 'text';

// Canonical, ordered list of every supported export format.
export const SupportedExportFormats: ExportFormat[] = ['csv', 'json', 'text'];

// Mapping from each supported format to the file extension used in `Content-Disposition`.
export const FormatExtensions: Record<ExportFormat, string> = {
    csv: 'csv',
    json: 'json',
    text: 'txt'
};
