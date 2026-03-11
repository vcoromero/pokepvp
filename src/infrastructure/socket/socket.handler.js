import { ValidationError } from '../../application/errors/Validation.error.js';
import { NotFoundError } from '../../application/errors/NotFound.error.js';

const ROOM_PREFIX = 'lobby:';

function errorPayload(err) {
  const code = err.name || (err.status != null ? String(err.status) : 'ERROR');
  return { code, message: err.message || 'Request failed' };
}

export class SocketHandler {
  constructor(
    joinLobbyUseCase,
    assignTeamUseCase,
    markReadyUseCase,
    startBattleUseCase,
    processAttackUseCase,
    realtimePort,
    lobbyRepository
  ) {
    this.joinLobbyUseCase = joinLobbyUseCase;
    this.assignTeamUseCase = assignTeamUseCase;
    this.markReadyUseCase = markReadyUseCase;
    this.startBattleUseCase = startBattleUseCase;
    this.processAttackUseCase = processAttackUseCase;
    this.realtimePort = realtimePort;
    this.lobbyRepository = lobbyRepository;
  }

  attach(io) {
    io.on('connection', (socket) => {
      socket.on('join_lobby', (payload, ack) => this.handleJoinLobby(socket, payload, ack));
      socket.on('assign_pokemon', (payload, ack) => this.handleAssignPokemon(socket, payload, ack));
      socket.on('ready', (payload, ack) => {
        this.handleReady(socket, payload, ack).catch((err) => {
          console.error('[ready] handler error', err?.stack ?? err);
          socket.emit('error', errorPayload(err));
          if (typeof ack === 'function') {
            try {
              ack({ error: errorPayload(err) });
            } catch (ackErr) {
              console.error('[ready] ack error', ackErr);
            }
          }
        });
      });
      socket.on('attack', (payload, ack) => {
        this.handleAttack(socket, payload, ack).catch((err) => {
          console.error('[attack] handler error', err);
          socket.emit('error', errorPayload(err));
          if (typeof ack === 'function') {
            try {
              ack({ error: errorPayload(err) });
            } catch (ackErr) {
              console.error('[attack] ack error', ackErr);
            }
          }
        });
      });
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
      const lobbyId = socket.data.lobbyId;
      const playerId = socket.data.playerId;
      if (!lobbyId || !playerId) {
        throw new ValidationError(
          'This connection has no player context. Send join_lobby with a nickname on this same connection first.'
        );
      }
      if (payload?.lobbyId && payload.lobbyId !== lobbyId) {
        throw new ValidationError('Socket is not in this lobby');
      }

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
      const lobbyId = socket.data.lobbyId;
      const playerId = socket.data.playerId;
      if (!lobbyId || !playerId) {
        throw new ValidationError(
          'This connection has no player context. Send join_lobby with a nickname on this same connection first.'
        );
      }
      if (payload?.lobbyId && payload.lobbyId !== lobbyId) {
        throw new ValidationError('Socket is not in this lobby');
      }

      const lobby = await this.markReadyUseCase.execute({ lobbyId, playerId });

      this.realtimePort.notifyLobbyStatus(lobbyId, { lobby });

      if (lobby?.status === 'ready' || lobby?.status === 'battling') {
        await this.startBattleUseCase.execute({ lobbyId });
      }

      if (typeof ack === 'function') {
        try {
          ack(JSON.parse(JSON.stringify(lobby)));
        } catch (ackErr) {
          console.error('[ready] ack error', ackErr?.stack ?? ackErr);
          socket.emit('error', errorPayload(ackErr));
        }
      }
    } catch (err) {
      console.error('[ready] error', err?.stack ?? err);
      socket.emit('error', errorPayload(err));
      if (typeof ack === 'function') {
        try {
          ack({ error: errorPayload(err) });
        } catch (ackErr) {
          console.error('[ready] ack error in catch', ackErr?.stack ?? ackErr);
        }
      }
    }
  }

  async handleAttack(socket, payload, ack) {
    const lobbyId = payload?.lobbyId;
    try {
      const attackerPlayerId = socket.data.playerId;

      if (!lobbyId) {
        throw new ValidationError('lobbyId is required');
      }
      if (!attackerPlayerId) {
        throw new ValidationError(
          'This connection has no player context. Send join_lobby with a nickname on this same connection first, then assign_pokemon and ready before attack.'
        );
      }
      if (socket.data.lobbyId !== lobbyId) {
        throw new ValidationError('Socket is not in this lobby');
      }

      const lobby = await this.lobbyRepository.findById(lobbyId);
      if (!lobby) {
        throw new NotFoundError('Lobby not found');
      }
      const defenderPlayerId = (lobby.playerIds ?? []).find((id) => id !== attackerPlayerId);
      if (!defenderPlayerId) {
        throw new ValidationError('No opponent in this lobby');
      }

      const turnResult = await this.processAttackUseCase.execute({
        lobbyId,
        attackerPlayerId,
        defenderPlayerId,
      });

      // Ensure ack payload is plain JSON so client (e.g. Postman) does not disconnect on serialization
      const safePayload = JSON.parse(JSON.stringify({
        battleId: turnResult.battleId,
        lobbyId: turnResult.lobbyId,
        attacker: turnResult.attacker,
        defender: turnResult.defender,
        nextActivePokemon: turnResult.nextActivePokemon,
        battleFinished: turnResult.battleFinished,
        ...(turnResult.nextToActPlayerId != null && { nextToActPlayerId: turnResult.nextToActPlayerId }),
      }));

      if (typeof ack === 'function') {
        try {
          ack(safePayload);
        } catch (ackErr) {
          console.error('[attack] ack serialization/emit error', ackErr?.stack ?? ackErr);
          socket.emit('error', errorPayload(ackErr));
        }
      }
    } catch (err) {
      console.error('[attack] handler error', err?.stack ?? err);
      socket.emit('error', errorPayload(err));
      if (typeof ack === 'function') {
        try {
          ack({ error: errorPayload(err) });
        } catch (ackErr) {
          console.error('[attack] ack error in catch', ackErr?.stack ?? ackErr);
        }
      }
    }
  }
}
