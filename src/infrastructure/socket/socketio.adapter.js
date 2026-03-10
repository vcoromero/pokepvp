const ROOM_PREFIX = 'lobby:';

/**
 * Socket.IO adapter implementing RealtimePort.
 * Emits server-to-client events to the room for the given lobby.
 * @param {import('socket.io').Server} io - Socket.IO server instance (or default namespace).
 */
export class SocketIOAdapter {
  constructor(io) {
    this.io = io;
  }

  roomName(lobbyId) {
    return ROOM_PREFIX + lobbyId;
  }

  notifyLobbyStatus(lobbyId, payload) {
    this.io.to(this.roomName(lobbyId)).emit('lobby_status', payload);
  }

  notifyBattleStart(lobbyId, payload) {
    this.io.to(this.roomName(lobbyId)).emit('battle_start', payload);
  }

  notifyTurnResult(lobbyId, payload) {
    this.io.to(this.roomName(lobbyId)).emit('turn_result', payload);
  }

  notifyBattleEnd(lobbyId, payload) {
    this.io.to(this.roomName(lobbyId)).emit('battle_end', payload);
  }
}
