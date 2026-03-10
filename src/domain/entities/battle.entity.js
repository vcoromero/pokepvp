/**
 * Battle entity shape. No MongoDB or framework dependencies.
 * @typedef {{ id?: string, lobbyId: string, startedAt?: Date, winnerId?: string, nextToActPlayerId?: string }} Battle
 */

export const LOBBY_ID_KEY = 'lobbyId';
export const STARTED_AT_KEY = 'startedAt';
export const WINNER_ID_KEY = 'winnerId';
export const NEXT_TO_ACT_PLAYER_ID_KEY = 'nextToActPlayerId';
