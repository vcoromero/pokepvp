import { NotFoundError } from '../errors/NotFound.error.js';
import { ConflictError } from '../errors/Conflict.error.js';
import { ValidationError } from '../errors/Validation.error.js';
import { resolveFirstTurn } from '../../domain/services/turn-resolver.js';

export class StartBattleUseCase {
  constructor(
    lobbyRepository,
    teamRepository,
    battleRepository,
    pokemonStateRepository,
    catalogPort,
    realtimePort
  ) {
    this.lobbyRepository = lobbyRepository;
    this.teamRepository = teamRepository;
    this.battleRepository = battleRepository;
    this.pokemonStateRepository = pokemonStateRepository;
    this.catalogPort = catalogPort;
    this.realtimePort = realtimePort;
  }

  async execute({ lobbyId }) {
    if (!lobbyId) {
      throw new ValidationError('lobbyId is required');
    }

    const lobby = await this.lobbyRepository.findById(lobbyId);
    if (!lobby) {
      throw new NotFoundError('Lobby not found');
    }

    if (lobby.status === 'battling') {
      const existingBattle = await this.battleRepository.findByLobbyId(lobbyId);
      if (existingBattle && !existingBattle.winnerId) {
        const pokemonStates = await this.pokemonStateRepository.findByBattleId(existingBattle.id);
        this.realtimePort.notifyBattleStart(lobbyId, {
          battle: existingBattle,
          pokemonStates,
        });
        return { battle: existingBattle, pokemonStates };
      }
    }
    if (lobby.status !== 'ready') {
      throw new ConflictError('Cannot start battle: lobby is not in ready state');
    }

    const teams = await this.teamRepository.findByLobby(lobbyId);
    if (!Array.isArray(teams) || teams.length !== 2) {
      throw new ValidationError('Lobby must have exactly two teams');
    }
    for (const team of teams) {
      const ids = team.pokemonIds ?? [];
      if (ids.length !== 3) {
        throw new ValidationError('Each team must have exactly 3 Pokémon');
      }
    }

    const existingBattle = await this.battleRepository.findByLobbyId(lobbyId);
    if (existingBattle && !existingBattle.winnerId) {
      const pokemonStates = await this.pokemonStateRepository.findByBattleId(existingBattle.id);
      await this.lobbyRepository.save({ ...lobby, status: 'battling' });
      this.realtimePort.notifyBattleStart(lobbyId, {
        battle: existingBattle,
        pokemonStates,
      });
      return { battle: existingBattle, pokemonStates };
    }

    const [teamA, teamB] = teams;
    const pokemonIdA = teamA.pokemonIds[0];
    const pokemonIdB = teamB.pokemonIds[0];
    const [detailA, detailB] = await Promise.all([
      this.catalogPort.getById(pokemonIdA),
      this.catalogPort.getById(pokemonIdB),
    ]);
    if (!detailA || !detailB) {
      throw new ValidationError('Missing catalog data for initial active Pokémon');
    }

    const nextToActPlayerId = resolveFirstTurn({
      speedA: detailA.speed ?? 0,
      speedB: detailB.speed ?? 0,
      playerIdA: teamA.playerId,
      playerIdB: teamB.playerId,
      pokemonIdA,
      pokemonIdB,
    });

    const battle = await this.battleRepository.save({
      lobbyId,
      startedAt: new Date(),
      winnerId: null,
      nextToActPlayerId,
    });

    const states = [];
    for (const team of teams) {
      const playerId = team.playerId;
      for (const pokemonId of team.pokemonIds ?? []) {
        const detail = await this.catalogPort.getById(pokemonId);
        if (!detail || typeof detail.hp !== 'number') {
          throw new ValidationError(`Missing or invalid catalog data for Pokémon ${pokemonId}`);
        }
        states.push({
          battleId: battle.id,
          pokemonId,
          playerId,
          currentHp: detail.hp,
          defeated: false,
        });
      }
    }

    const pokemonStates = await this.pokemonStateRepository.saveMany(states);
    await this.lobbyRepository.save({ ...lobby, status: 'battling' });

    this.realtimePort.notifyBattleStart(lobbyId, {
      battle,
      pokemonStates,
    });

    return { battle, pokemonStates };
  }
}
