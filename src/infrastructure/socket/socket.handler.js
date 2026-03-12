import { ValidationError } from '../../application/errors/Validation.error.js';

const ROOM_PREFIX = 'lobby:';

function errorPayload(err) {
  const code = err.name || (err.status != null ? String(err.status) : 'ERROR');
  return { code, message: err.message || 'Request failed' };
}

function safeAck(ack, payload) {
  if (typeof ack !== 'function') return;
  try {
    ack(payload);
  } catch (e) {
    console.error('ack error', e);
  }
}

function logError(eventName, err) {
  if (process.env.NODE_ENV === 'production') {
    console.error(`[${eventName}] [${err.name}] ${err.message}`);
  } else {
    console.error(`[${eventName}] error`, err?.stack ?? err);
  }
}

function wrapHandler(fn, eventName) {
  return async (socket, payload, ack) => {
    try {
      const result = await fn(socket, payload);
      safeAck(ack, result);
    } catch (err) {
      logError(eventName, err);
      socket.emit('error', errorPayload(err));
      safeAck(ack, { error: errorPayload(err) });
    }
  };
}

export class SocketHandler {
  constructor(
    joinLobbyUseCase,
    rejoinLobbyUseCase,
    assignTeamUseCase,
    markReadyUseCase,
    startBattleUseCase,
    processAttackUseCase,
    surrenderBattleUseCase,
    realtimePort
  ) {
    this.joinLobbyUseCase = joinLobbyUseCase;
    this.rejoinLobbyUseCase = rejoinLobbyUseCase;
    this.assignTeamUseCase = assignTeamUseCase;
    this.markReadyUseCase = markReadyUseCase;
    this.startBattleUseCase = startBattleUseCase;
    this.processAttackUseCase = processAttackUseCase;
    this.surrenderBattleUseCase = surrenderBattleUseCase;
    this.realtimePort = realtimePort;
  }

  attach(io) {
    io.on('connection', (socket) => {
      socket.on('join_lobby', (payload, ack) =>
        wrapHandler((s, p) => this.handleJoinLobby(s, p), 'join_lobby')(socket, payload, ack));
      socket.on('rejoin_lobby', (payload, ack) =>
        wrapHandler((s, p) => this.handleRejoinLobby(s, p), 'rejoin_lobby')(socket, payload, ack));
      socket.on('assign_pokemon', (payload, ack) =>
        wrapHandler((s, p) => this.handleAssignPokemon(s, p), 'assign_pokemon')(socket, payload, ack));
      socket.on('ready', (payload, ack) =>
        wrapHandler((s, p) => this.handleReady(s, p), 'ready')(socket, payload, ack));
      socket.on('attack', (payload, ack) =>
        wrapHandler((s, p) => this.handleAttack(s, p), 'attack')(socket, payload, ack));
      socket.on('surrender', (payload, ack) =>
        wrapHandler((s, p) => this.handleSurrender(s, p), 'surrender')(socket, payload, ack));
    });
  }

  requirePlayerContext(socket) {
    const { lobbyId, playerId } = socket.data;
    if (!lobbyId || !playerId) {
      throw new ValidationError(
        'This connection has no player context. Send join_lobby with a nickname on this same connection first.'
      );
    }
    return { lobbyId, playerId };
  }

  async handleJoinLobby(socket, payload) {
    const nickname = payload?.nickname;
    const result = await this.joinLobbyUseCase.execute({ nickname });
    const { player, lobby } = result;

    socket.join(ROOM_PREFIX + lobby.id);
    socket.data.lobbyId = lobby.id;
    socket.data.playerId = player.id;

    this.realtimePort.notifyLobbyStatus(lobby.id, { lobby, player });
    return { player, lobby };
  }

  async handleRejoinLobby(socket, payload) {
    const result = await this.rejoinLobbyUseCase.execute({
      playerId: payload?.playerId,
      lobbyId: payload?.lobbyId,
    });
    const { player, lobby } = result;

    socket.join(ROOM_PREFIX + lobby.id);
    socket.data.lobbyId = lobby.id;
    socket.data.playerId = player.id;

    this.realtimePort.notifyLobbyStatus(lobby.id, { lobby });
    return { player, lobby };
  }

  async handleAssignPokemon(socket, payload) {
    const { lobbyId, playerId } = this.requirePlayerContext(socket);
    if (payload?.lobbyId && payload.lobbyId !== lobbyId) {
      throw new ValidationError('Socket is not in this lobby');
    }

    const { team, lobby } = await this.assignTeamUseCase.execute({ lobbyId, playerId });

    if (!socket.rooms.has(ROOM_PREFIX + lobbyId)) {
      socket.join(ROOM_PREFIX + lobbyId);
    }

    if (lobby) {
      this.realtimePort.notifyLobbyStatus(lobbyId, { lobby });
    }

    return team;
  }

  async handleReady(socket, payload) {
    const { lobbyId, playerId } = this.requirePlayerContext(socket);
    if (payload?.lobbyId && payload.lobbyId !== lobbyId) {
      throw new ValidationError('Socket is not in this lobby');
    }

    const lobby = await this.markReadyUseCase.execute({ lobbyId, playerId });

    this.realtimePort.notifyLobbyStatus(lobbyId, { lobby });

    if (lobby?.status === 'ready' || lobby?.status === 'battling') {
      await this.startBattleUseCase.execute({ lobbyId });
    }

    return JSON.parse(JSON.stringify(lobby));
  }

  async handleAttack(socket, payload) {
    const lobbyId = payload?.lobbyId;
    if (!lobbyId) {
      throw new ValidationError('lobbyId is required');
    }

    const attackerPlayerId = socket.data.playerId;
    if (!attackerPlayerId) {
      throw new ValidationError(
        'This connection has no player context. Send join_lobby with a nickname on this same connection first, then assign_pokemon and ready before attack.'
      );
    }
    if (socket.data.lobbyId !== lobbyId) {
      throw new ValidationError('Socket is not in this lobby');
    }

    const turnResult = await this.processAttackUseCase.execute({
      lobbyId,
      attackerPlayerId,
    });

    return JSON.parse(JSON.stringify({
      battleId: turnResult.battleId,
      lobbyId: turnResult.lobbyId,
      attacker: turnResult.attacker,
      defender: turnResult.defender,
      nextActivePokemon: turnResult.nextActivePokemon,
      battleFinished: turnResult.battleFinished,
      ...(turnResult.nextToActPlayerId != null && { nextToActPlayerId: turnResult.nextToActPlayerId }),
    }));
  }

  async handleSurrender(socket, payload) {
    const { lobbyId, playerId } = this.requirePlayerContext(socket);
    if (payload?.lobbyId && payload.lobbyId !== lobbyId) {
      throw new ValidationError('Socket is not in this lobby');
    }

    const result = await this.surrenderBattleUseCase.execute({
      lobbyId,
      surrenderingPlayerId: playerId,
    });

    return JSON.parse(JSON.stringify(result));
  }
}
