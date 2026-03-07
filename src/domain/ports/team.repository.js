/**
 * Team repository output port.
 * Domain defines the contract; infrastructure (e.g. mongo adapter) implements it.
 *
 * @typedef {import('../entities/team.entity.js').Team} Team
 * @typedef {Object} TeamRepository
 * @property {(team: Partial<Team>) => Promise<Team>} save
 * @property {(lobbyId: string, playerId: string) => Promise<Team|null>} findByLobbyAndPlayer
 * @property {(lobbyId: string) => Promise<Team[]>} findByLobby
 */

// Adapter passed at bootstrap must implement save(team), findByLobbyAndPlayer(lobbyId, playerId), findByLobby(lobbyId).
