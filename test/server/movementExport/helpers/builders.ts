/*
 * Test-double builders for the `game-movement-export` feature.
 *
 * Exports
 * -------
 * - `aMovement(overrides?)`          -> `IGameMovement` with sensible defaults
 * - `aSerializedMessage(overrides?)` -> `ISerializedMessage` with sensible defaults
 * - `aLobbyDouble(opts)`             -> `{ lobby, game }` duck-typed stubs sufficient
 *                                       for the route handler and authorizer tests
 *
 * Design notes
 * ------------
 * The route handler and authorizer only access a small subset of the real
 * `Lobby` and `Game` surfaces:
 *
 *   Lobby:
 *     - `id: string`
 *     - `users: Array<{ id: string; username: string; state: string; ready: boolean }>`
 *     - `spectators: Array<{ id: string; username: string; state: string }>`
 *     - `spectationAllowed: boolean`  (getter in production; plain property here)
 *     - `hasOngoingGame(): boolean`
 *     - `game?: { getLogMessages(max: null): ISerializedMessage[] }`
 *
 *   Game:
 *     - `getLogMessages(max: null): ISerializedMessage[]`
 *
 * `UserRole` and `ILobbyMapping` are module-private in `GameServer.ts` so they
 * are redeclared here for use in the `userLobby` map passed to `aLobbyDouble`.
 *
 * Purity
 * ------
 * No `fs`, no I/O, no logging. All builders are pure functions of their
 * arguments and the constants below.
 */

import type { ISerializedMessage } from '../../../../server/game/Interfaces';
import type { IGameMovement } from '../../../../server/game/movementExport/MovementTypes';

// ---------------------------------------------------------------------------
// Re-declared types (module-private in GameServer.ts)
// ---------------------------------------------------------------------------

export enum UserRole {
    Player = 'player',
    Spectator = 'spectator'
}

export interface ILobbyMapping {
    lobbyId: string;
    role: UserRole;
}

// ---------------------------------------------------------------------------
// Minimal duck-typed stubs
// ---------------------------------------------------------------------------

/** Minimal player/spectator entry shape used in `lobby.users` and `lobby.spectators`. */
export interface ILobbyUserStub {
    id: string;
    username: string;
    state: 'connected' | 'disconnected';
    ready: boolean;
}

export interface ILobbySpectatorStub {
    id: string;
    username: string;
    state: 'connected' | 'disconnected';
}

/** Duck-typed game stub — only the surface the route handler touches. */
export interface IGameStub {
    getLogMessages(max: null): ISerializedMessage[];
}

/** Duck-typed lobby stub — only the surface the route handler and authorizer touch. */
export interface ILobbyStub {
    id: string;
    users: ILobbyUserStub[];
    spectators: ILobbySpectatorStub[];
    spectationAllowed: boolean;
    hasOngoingGame(): boolean;
    game: IGameStub | undefined;
}

// ---------------------------------------------------------------------------
// `aMovement` — IGameMovement builder
// ---------------------------------------------------------------------------

const DEFAULT_MOVEMENT: IGameMovement = {
    timestamp: '2024-01-15T12:34:56.789Z',
    player: 'Player1',
    action: 'played a card',
    details: ''
};

/**
 * Build an `IGameMovement` with sensible defaults. Pass `overrides` to
 * replace individual fields without specifying the rest.
 */
export function aMovement(overrides?: Partial<IGameMovement>): IGameMovement {
    return { ...DEFAULT_MOVEMENT, ...overrides };
}

// ---------------------------------------------------------------------------
// `aSerializedMessage` — ISerializedMessage builder
// ---------------------------------------------------------------------------

const DEFAULT_SERIALIZED_MESSAGE: ISerializedMessage = {
    date: new Date('2024-01-15T12:34:56.789Z'),
    message: 'Player1 played a card'
};

/**
 * Build an `ISerializedMessage` with sensible defaults. Pass `overrides` to
 * replace individual fields without specifying the rest.
 */
export function aSerializedMessage(overrides?: Partial<ISerializedMessage>): ISerializedMessage {
    return { ...DEFAULT_SERIALIZED_MESSAGE, ...overrides };
}

// ---------------------------------------------------------------------------
// `aLobbyDouble` — lobby + game stub factory
// ---------------------------------------------------------------------------

export interface ILobbyDoubleOptions {
    // Player entries to populate `lobby.users`. Defaults to `[]`.
    players?: ILobbyUserStub[];

    // Spectator entries to populate `lobby.spectators`. Defaults to `[]`.
    spectators?: ILobbySpectatorStub[];

    // Whether anonymous spectators are allowed. Defaults to `false`.
    allowSpectators?: boolean;

    // Messages returned by `game.getLogMessages(null)`. Defaults to `[]`.
    messages?: ISerializedMessage[];

    // Whether the lobby has an ongoing game. When `true` a `game` stub is
    // attached; when `false` (the default) `lobby.game` is `undefined` and
    // `hasOngoingGame()` returns `false`.
    hasOngoingGame?: boolean;

    // Override the lobby id. Defaults to `'test-lobby-id'`.
    lobbyId?: string;
}

export interface ILobbyDouble {
    lobby: ILobbyStub;
    game: IGameStub | undefined;
}

/**
 * Build a duck-typed `{ lobby, game }` pair sufficient for the route handler
 * and authorizer tests. The returned objects satisfy the minimal interface
 * surface accessed by the handler without importing the real `Lobby` or
 * `Game` classes.
 */
export function aLobbyDouble(opts: ILobbyDoubleOptions = {}): ILobbyDouble {
    const {
        players = [],
        spectators = [],
        allowSpectators = false,
        messages = [],
        hasOngoingGame = false,
        lobbyId = 'test-lobby-id'
    } = opts;

    const game: IGameStub | undefined = hasOngoingGame
        ? { getLogMessages: () => messages }
        : undefined;

    const lobby: ILobbyStub = {
        id: lobbyId,
        users: players,
        spectators,
        spectationAllowed: allowSpectators,
        hasOngoingGame: () => hasOngoingGame,
        game
    };

    return { lobby, game };
}
