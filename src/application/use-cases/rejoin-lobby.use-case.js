import { ValidationError } from '../errors/Validation.error.js';
import { NotFoundError } from '../errors/NotFound.error.js';
import { ConflictError } from '../errors/Conflict.error.js';
import { Lobby } from '../../domain/entities/lobby.entity.js';

const REJOINABLE_STATUSES = ['waiting', 'ready', 'battling'];

export class RejoinLobbyUseCase {
  constructor(playerRepository, lobbyRepository) {
    this.playerRepository = playerRepository;
    this.lobbyRepository = lobbyRepository;
  }

  async execute({ playerId, lobbyId }) {
    if (!playerId || !lobbyId) {
      throw new ValidationError('playerId and lobbyId are required');
    }

    const player = await this.playerRepository.findById(playerId);
    if (!player) {
      throw new NotFoundError('Player not found');
    }
    if (player.lobbyId !== lobbyId) {
      throw new ConflictError('Player does not belong to this lobby');
    }

    const lobbyPlain = await this.lobbyRepository.findById(lobbyId);
    if (!lobbyPlain) {
      throw new NotFoundError('Lobby not found');
    }

    const lobby = Lobby.from(lobbyPlain);
    if (!lobby.hasPlayer(playerId)) {
      throw new NotFoundError('Player is not in this lobby');
    }
    if (!REJOINABLE_STATUSES.includes(lobby.status)) {
      if (lobby.status === 'finished') {
        throw new ConflictError('Cannot rejoin: lobby is finished');
      }
      throw new ConflictError('Cannot rejoin: lobby status is invalid for rejoin');
    }

    return { player, lobby: lobbyPlain };
  }
}
