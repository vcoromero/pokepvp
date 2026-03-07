/**
 * Lobby entity shape. No MongoDB or framework dependencies.
 * @typedef {{ id?: string, status: LobbyStatus, playerIds: string[], createdAt?: Date }} Lobby
 */

/** @type {readonly ['waiting', 'ready', 'battling', 'finished']} */
export const LOBBY_STATUSES = Object.freeze(['waiting', 'ready', 'battling', 'finished']);

/** @typedef {'waiting' | 'ready' | 'battling' | 'finished'} LobbyStatus */

export const STATUS_KEY = 'status';
export const PLAYER_IDS_KEY = 'playerIds';
export const CREATED_AT_KEY = 'createdAt';
