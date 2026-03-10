/**
 * Realtime output port.
 * Domain defines the contract; infrastructure (e.g. Socket.IO adapter) implements it.
 * Used to notify connected clients in a lobby room. Room membership is the adapter's concern.
 *
 * @typedef {Object} RealtimePort
 * @property {(lobbyId: string, payload: object) => void | Promise<void>} notifyLobbyStatus
 *   Emit current lobby state to all clients in the lobby room (e.g. after join, assign-team, ready).
 * @property {(lobbyId: string, payload: object) => void | Promise<void>} notifyBattleStart
 *   Signal that the battle has started (e.g. when both players are ready; full flow in Stage 6).
 * @property {(lobbyId: string, payload: object) => void | Promise<void>} notifyTurnResult
 *   Send the outcome of a turn (damage, remaining HP, defeat/switch). Stage 6 implements the logic.
 * @property {(lobbyId: string, payload: object) => void | Promise<void>} notifyBattleEnd
 *   Signal that the battle has ended (e.g. winner id).
 */

// In plain JS there is no "interface" type; the adapter passed at bootstrap
// must implement the four notify* methods. Use cases and handlers depend on this shape.
