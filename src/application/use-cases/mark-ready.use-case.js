import { ValidationError } from '../errors/Validation.error.js';
import { NotFoundError } from '../errors/NotFound.error.js';

function hasBothPlayersReady(lobby) {
  const playerIds = lobby.playerIds ?? [];
  const readyPlayerIds = lobby.readyPlayerIds ?? [];

  if (playerIds.length !== 2 || readyPlayerIds.length < 2) {
    return false;
  }

  return playerIds.every((playerId) => readyPlayerIds.includes(playerId));
}

export class MarkReadyUseCase {
  constructor(lobbyRepository, teamRepository) {
    this.lobbyRepository = lobbyRepository;
    this.teamRepository = teamRepository;
  }

  async execute({ lobbyId, playerId }) {
    if (!lobbyId || !playerId) {
      throw new ValidationError('lobbyId and playerId are required');
    }

    const lobby = await this.lobbyRepository.findById(lobbyId);
    if (!lobby) {
      throw new NotFoundError('Lobby not found');
    }

    if (!(lobby.playerIds ?? []).includes(playerId)) {
      throw new NotFoundError('Player is not in this lobby');
    }

    const team = await this.teamRepository.findByLobbyAndPlayer(lobbyId, playerId);
    if (!team) {
      throw new ValidationError('Player must have an assigned team before marking ready');
    }

    const readyPlayerIds = new Set(lobby.readyPlayerIds ?? []);
    if (readyPlayerIds.has(playerId)) {
      return lobby;
    }

    readyPlayerIds.add(playerId);
    const updatedLobby = await this.lobbyRepository.save({
      ...lobby,
      readyPlayerIds: [...readyPlayerIds],
    });

    if (hasBothPlayersReady(updatedLobby)) {
      return this.lobbyRepository.save({
        ...updatedLobby,
        status: 'ready',
      });
    }

    return updatedLobby;
  }
}
