const ROOM_PREFIX = 'lobby:';

function errorPayload(err) {
  const code = err.name || (err.status != null ? String(err.status) : 'ERROR');
  return { code, message: err.message || 'Request failed' };
}

export class SocketHandler {
  constructor(joinLobbyUseCase, assignTeamUseCase, markReadyUseCase, realtimePort, lobbyRepository) {
    this.joinLobbyUseCase = joinLobbyUseCase;
    this.assignTeamUseCase = assignTeamUseCase;
    this.markReadyUseCase = markReadyUseCase;
    this.realtimePort = realtimePort;
    this.lobbyRepository = lobbyRepository;
  }

  attach(io) {
    io.on('connection', (socket) => {
      socket.on('join_lobby', (payload, ack) => this.handleJoinLobby(socket, payload, ack));
      socket.on('assign_pokemon', (payload, ack) => this.handleAssignPokemon(socket, payload, ack));
      socket.on('ready', (payload, ack) => this.handleReady(socket, payload, ack));
      socket.on('attack', (payload, ack) => this.handleAttack(socket, payload, ack));
    });
  }

  async handleJoinLobby(socket, payload, ack) {
    try {
      const nickname = payload?.nickname;
      const result = await this.joinLobbyUseCase.execute({ nickname });
      const { player, lobby } = result;

      socket.join(ROOM_PREFIX + lobby.id);
      socket.data.lobbyId = lobby.id;
      socket.data.playerId = player.id;

      this.realtimePort.notifyLobbyStatus(lobby.id, { lobby, player });
      if (typeof ack === 'function') {
        ack({ player, lobby });
      }
    } catch (err) {
      socket.emit('error', errorPayload(err));
      if (typeof ack === 'function') {
        ack({ error: errorPayload(err) });
      }
    }
  }

  async handleAssignPokemon(socket, payload, ack) {
    try {
      const { lobbyId, playerId } = payload ?? {};
      const team = await this.assignTeamUseCase.execute({ lobbyId, playerId });

      if (lobbyId && !socket.rooms.has(ROOM_PREFIX + lobbyId)) {
        socket.join(ROOM_PREFIX + lobbyId);
      }

      const lobby = await this.lobbyRepository.findById(lobbyId);
      if (lobby) {
        this.realtimePort.notifyLobbyStatus(lobbyId, { lobby });
      }

      if (typeof ack === 'function') {
        ack(team);
      }
    } catch (err) {
      socket.emit('error', errorPayload(err));
      if (typeof ack === 'function') {
        ack({ error: errorPayload(err) });
      }
    }
  }

  async handleReady(socket, payload, ack) {
    try {
      const { lobbyId, playerId } = payload ?? {};
      const lobby = await this.markReadyUseCase.execute({ lobbyId, playerId });

      this.realtimePort.notifyLobbyStatus(lobbyId, { lobby });

      if (typeof ack === 'function') {
        ack(lobby);
      }
    } catch (err) {
      socket.emit('error', errorPayload(err));
      if (typeof ack === 'function') {
        ack({ error: errorPayload(err) });
      }
    }
  }

  handleAttack(socket, _payload, ack) {
    socket.emit('error', { code: 'attack_not_available', message: 'Attack not implemented yet (Stage 6)' });
    if (typeof ack === 'function') {
      ack({ error: { code: 'attack_not_available', message: 'Attack not implemented yet (Stage 6)' } });
    }
  }
}
