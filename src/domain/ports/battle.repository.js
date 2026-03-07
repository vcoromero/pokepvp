/**
 * Battle repository output port.
 * Domain defines the contract; infrastructure (e.g. mongo adapter) implements it.
 *
 * @typedef {import('../entities/battle.entity.js').Battle} Battle
 * @typedef {Object} BattleRepository
 * @property {(battle: Partial<Battle>) => Promise<Battle>} save
 * @property {(id: string) => Promise<Battle|null>} findById
 * @property {(lobbyId: string) => Promise<Battle|null>} findByLobbyId
 */

// Adapter passed at bootstrap must implement save(battle), findById(id), findByLobbyId(lobbyId).
