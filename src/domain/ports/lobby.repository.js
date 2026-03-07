/**
 * Lobby repository output port.
 * Domain defines the contract; infrastructure (e.g. mongo adapter) implements it.
 *
 * @typedef {import('../entities/lobby.entity.js').Lobby} Lobby
 * @typedef {Object} LobbyRepository
 * @property {(lobby: Partial<Lobby>) => Promise<Lobby>} save
 * @property {(id: string) => Promise<Lobby|null>} findById
 * @property {() => Promise<Lobby|null>} findActive
 */

// Adapter passed at bootstrap must implement save(lobby), findById(id), findActive().
