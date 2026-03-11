import { ConflictError } from '../errors/Conflict.error.js';
import { Nickname } from '../../domain/value-objects/nickname.js';
import { Lobby } from '../../domain/entities/lobby.entity.js';

export class JoinLobbyUseCase {
  constructor(playerRepository, lobbyRepository) {
    this.playerRepository = playerRepository;
    this.lobbyRepository = lobbyRepository;
  }

  async execute({ nickname }) {
    const validNickname = new Nickname(nickname);
    const activePlain = await this.lobbyRepository.findActive();

    if (!activePlain) {
      return this.createLobbyAndJoin(validNickname.value);
    }

    const lobby = Lobby.from(activePlain);

    if (!lobby.canJoin()) {
      throw new ConflictError(
        lobby.isFull() ? 'Lobby is full' : 'Cannot join lobby that is not waiting'
      );
    }

    return this.joinExistingLobby(lobby, validNickname.value);
  }

  async createLobbyAndJoin(nickname) {
    const initialLobby = await this.lobbyRepository.save(
      new Lobby().toPlain()
    );

    const player = await this.playerRepository.save({
      nickname,
      lobbyId: initialLobby.id,
    });

    const lobby = await this.lobbyRepository.save(
      Lobby.from(initialLobby).addPlayer(player.id).toPlain()
    );

    return { player, lobby };
  }

  async joinExistingLobby(lobby, nickname) {
    const player = await this.playerRepository.save({
      nickname,
      lobbyId: lobby.id,
    });

    const updatedLobby = await this.lobbyRepository.save(
      lobby.addPlayer(player.id).toPlain()
    );

    return { player, lobby: updatedLobby };
  }
}
