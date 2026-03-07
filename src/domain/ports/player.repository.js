/**
 * Player repository output port.
 * Domain defines the contract; infrastructure (e.g. mongo adapter) implements it.
 *
 * @typedef {import('../entities/player.entity.js').Player} Player
 * @typedef {Object} PlayerRepository
 * @property {(player: Partial<Player>) => Promise<Player>} save
 * @property {(id: string) => Promise<Player|null>} findById
 * @property {(lobbyId: string) => Promise<Player[]>} findByLobbyId
 */

// Adapter passed at bootstrap must implement save(player), findById(id), findByLobbyId(lobbyId).
