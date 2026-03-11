import { ValidationError } from '../errors/Validation.error.js';
import { NotFoundError } from '../errors/NotFound.error.js';
import { Lobby } from '../../domain/entities/lobby.entity.js';

export class MarkReadyUseCase {
  constructor(lobbyRepository, teamRepository) {
    this.lobbyRepository = lobbyRepository;
    this.teamRepository = teamRepository;
  }

  async execute({ lobbyId, playerId }) {
    if (!lobbyId || !playerId) {
      throw new ValidationError('lobbyId and playerId are required');
    }

    const lobby = Lobby.from(await this.lobbyRepository.findById(lobbyId));
    if (!lobby) {
      throw new NotFoundError('Lobby not found');
    }
    if (!lobby.hasPlayer(playerId)) {
      throw new NotFoundError('Player is not in this lobby');
    }

    const team = await this.teamRepository.findByLobbyAndPlayer(lobbyId, playerId);
    if (!team) {
      throw new ValidationError('Player must have an assigned team before marking ready');
    }

    if (lobby.isAlreadyReady(playerId)) {
      return lobby.toPlain();
    }

    const readied = lobby.markReady(playerId);
    const saved = await this.lobbyRepository.save(readied.toPlain());

    if (Lobby.from(saved).isEveryoneReady()) {
      return this.lobbyRepository.save(
        Lobby.from(saved).withStatus('ready').toPlain()
      );
    }

    return saved;
  }
}
