import { NotFoundError } from '../errors/NotFound.error.js';
import { ConflictError } from '../errors/Conflict.error.js';
import { ValidationError } from '../errors/Validation.error.js';
import { Lobby } from '../../domain/entities/lobby.entity.js';

export class SurrenderBattleUseCase {
  constructor(lobbyRepository, battleRepository, realtimePort) {
    this.lobbyRepository = lobbyRepository;
    this.battleRepository = battleRepository;
    this.realtimePort = realtimePort;
  }

  async execute({ lobbyId, surrenderingPlayerId }) {
    if (!lobbyId || !surrenderingPlayerId) {
      throw new ValidationError('lobbyId and surrenderingPlayerId are required');
    }

    const lobbyPlain = await this.lobbyRepository.findById(lobbyId);
    if (!lobbyPlain) {
      throw new NotFoundError('Lobby not found');
    }

    const lobby = Lobby.from(lobbyPlain);
    if (!lobby.hasPlayer(surrenderingPlayerId)) {
      throw new ValidationError('Player is not in this lobby');
    }

    if (lobby.status !== 'battling') {
      throw new ConflictError('Cannot surrender when battle is not in progress');
    }

    const opponentId = (lobby.playerIds ?? []).find((id) => id !== surrenderingPlayerId);
    if (!opponentId) {
      throw new ValidationError('No opponent in this lobby');
    }

    const battle = await this.battleRepository.findByLobbyId(lobbyId);
    if (!battle) {
      throw new NotFoundError('Battle not found');
    }
    if (battle.winnerId) {
      throw new ConflictError('Battle already finished');
    }

    const finishedBattle = await this.battleRepository.save({
      ...battle,
      winnerId: opponentId,
    });

    const finishedLobby = await this.lobbyRepository.save(
      lobby.withStatus('finished').toPlain()
    );

    const payload = {
      battleId: finishedBattle.id,
      lobbyId,
      winnerId: opponentId,
      loserId: surrenderingPlayerId,
      reason: 'surrender',
      lobby: finishedLobby,
    };

    this.realtimePort.notifyBattleEnd(lobbyId, payload);

    return payload;
  }
}

