import { ValidationError } from '../errors/Validation.error.js';
import { ConflictError } from '../errors/Conflict.error.js';

export class JoinLobbyUseCase {
  constructor(playerRepository, lobbyRepository) {
    this.playerRepository = playerRepository;
    this.lobbyRepository = lobbyRepository;
  }

  async execute({ nickname }) {
    const trimmedNickname = this.validateNickname(nickname);
    const activeLobby = await this.lobbyRepository.findActive();

    if (!activeLobby) {
      return this.createLobbyAndJoin(trimmedNickname);
    }

    if (activeLobby.status !== 'waiting') {
      throw new ConflictError('Cannot join lobby that is not waiting');
    }

    if ((activeLobby.playerIds ?? []).length >= 2) {
      throw new ConflictError('Lobby is full');
    }

    return this.joinExistingLobby(activeLobby, trimmedNickname);
  }

  validateNickname(nickname) {
    if (nickname == null || typeof nickname !== 'string') {
      throw new ValidationError('nickname is required and must be a string');
    }

    const trimmed = nickname.trim();
    if (trimmed.length === 0) {
      throw new ValidationError('nickname cannot be empty');
    }

    return trimmed;
  }

  async createLobbyAndJoin(nickname) {
    const initialLobby = await this.lobbyRepository.save({
      status: 'waiting',
      playerIds: [],
      readyPlayerIds: [],
    });

    const player = await this.playerRepository.save({
      nickname,
      lobbyId: initialLobby.id,
    });

    const lobby = await this.lobbyRepository.save({
      ...initialLobby,
      playerIds: [player.id],
      readyPlayerIds: [],
    });

    return { player, lobby };
  }

  async joinExistingLobby(lobby, nickname) {
    const player = await this.playerRepository.save({
      nickname,
      lobbyId: lobby.id,
    });

    const updatedLobby = await this.lobbyRepository.save({
      ...lobby,
      playerIds: [...(lobby.playerIds ?? []), player.id],
      readyPlayerIds: lobby.readyPlayerIds ?? [],
    });

    return { player, lobby: updatedLobby };
  }
}
