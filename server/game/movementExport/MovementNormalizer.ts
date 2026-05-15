import type { ISerializedMessage, MessageText } from '../Interfaces';
import type { IGameMovement } from './MovementTypes';

/**
 * Heuristic shape of the first element in a player-tagged `ISerializedMessage`
 * array. `GameChat.addChatMessage` and similar helpers prepend an object of
 * this shape (e.g. `{ name, id, type: 'playerChat' }`) so the renderer can
 * highlight the acting player. The normalizer uses the same shape to recover
 * the player's display name from a movement entry.
 */
interface IPlayerLikeArg {
    name: string;
    id: string;
    type: string;
}

/**
 * Pure transformation from the in-memory `GameChat` message buffer
 * (`ISerializedMessage[]`) to the flat row shape used by every export
 * formatter (`IGameMovement[]`).
 *
 * The normalizer is intentionally heuristic: `ISerializedMessage` is a
 * free-form rendered template, so the mapping is decided by the structural
 * shape of `entry.message` rather than by a tag field. The branches here
 * match the design document:
 *
 *  - `{ alert: { type, message } }` -> `(player='', action=type, details=joinText(message))`
 *  - array whose first element is `{ name, id, type }` -> `(player=first.name, action=joinText(rest), details='')`
 *  - anything else -> `(player='', action=joinText(message), details='')`
 *
 * The class performs no I/O, no logging, and no filesystem access; every
 * method is pure and deterministic so it can be exercised directly by
 * property-based tests.
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Static-only class is intentional: the design contract exposes `MovementNormalizer.normalize(...)` as the public API surface used by `MovementExporter` and the property tests.
export class MovementNormalizer {
    /**
     * Convert an array of `ISerializedMessage` entries into normalized movement
     * rows. Entry order, count, and timestamps are preserved exactly so
     * downstream formatters can stream rows in source order.
     */
    public static normalize(messages: ISerializedMessage[]): IGameMovement[] {
        const result: IGameMovement[] = [];

        for (const entry of messages) {
            result.push(MovementNormalizer.normalizeEntry(entry));
        }

        return result;
    }

    /**
     * Normalize a single message entry. Extracted as a separate step so the
     * branching logic stays readable and so each branch can be reasoned about
     * independently.
     */
    private static normalizeEntry(entry: ISerializedMessage): IGameMovement {
        const timestamp = new Date(entry.date).toISOString();
        const message = entry.message;

        if (MovementNormalizer.isAlertMessage(message)) {
            return {
                timestamp,
                player: '',
                action: message.alert.type,
                details: MovementNormalizer.joinText(message.alert.message)
            };
        }

        if (Array.isArray(message) && message.length > 0 && MovementNormalizer.isPlayerLikeArg(message[0])) {
            const arr = message as unknown as unknown[];
            const first = arr[0] as IPlayerLikeArg;
            const rest = arr.slice(1) as (string | number)[];
            return {
                timestamp,
                player: first.name,
                action: MovementNormalizer.joinText(rest),
                details: ''
            };
        }

        return {
            timestamp,
            player: '',
            action: MovementNormalizer.joinText(message as MessageText),
            details: ''
        };
    }

    /**
     * Flatten a `MessageText` (`string | (string | number)[]`) into a single
     * string. Numbers are stringified via the default `String` coercion;
     * strings pass through unchanged. Returns the empty string for an empty
     * array so downstream fields are never `null` or `undefined`.
     */
    private static joinText(text: MessageText): string {
        if (typeof text === 'string') {
            return text;
        }

        let out = '';
        for (const part of text) {
            out += typeof part === 'string' ? part : String(part);
        }
        return out;
    }

    /**
     * Type guard for the alert-shaped `message` variant. The renderer wraps
     * alert payloads in `{ alert: { type, message } }`; matching this shape
     * lets the normalizer surface the alert `type` as the movement action.
     */
    private static isAlertMessage(
        message: ISerializedMessage['message']
    ): message is { alert: { type: string; message: string | string[] } } {
        return (
            typeof message === 'object' &&
            message !== null &&
            !Array.isArray(message) &&
            'alert' in message &&
            typeof (message as { alert: unknown }).alert === 'object' &&
            (message as { alert: unknown }).alert !== null
        );
    }

    /**
     * Type guard for the player-tagged first argument. `GameChat` prepends
     * objects of this shape when a movement is attributed to a specific
     * player; the normalizer uses `.name` as the `player` column value.
     */
    private static isPlayerLikeArg(value: unknown): value is IPlayerLikeArg {
        if (typeof value !== 'object' || value === null) {
            return false;
        }
        const candidate = value as Record<string, unknown>;
        return (
            typeof candidate.name === 'string' &&
            typeof candidate.id === 'string' &&
            typeof candidate.type === 'string'
        );
    }
}
