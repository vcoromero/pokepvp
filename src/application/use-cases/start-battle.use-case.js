import { NotFoundError } from '../errors/NotFound.error.js';
import { ConflictError } from '../errors/Conflict.error.js';
import { ValidationError } from '../errors/Validation.error.js';

/**
 * Returns the playerId who acts first (first turn only), using Speed and deterministic tiebreaker.
 * @param {{ speed?: number }} detailA - Catalog detail for player A's initial active Pokémon
 * @param {{ speed?: number }} detailB - Catalog detail for player B's initial active Pokémon
 * @param {string} playerIdA - Player A id
 * @param {string} playerIdB - Player B id
 * @param {number} pokemonIdA - Player A's initial active Pokémon id
 * @param {number} pokemonIdB - Player B's initial active Pokémon id
 * @returns {string} playerIdA or playerIdB
 */
function getFirstToActPlayerId(detailA, detailB, playerIdA, playerIdB, pokemonIdA, pokemonIdB) {
  const speedA = detailA.speed ?? 0;
  const speedB = detailB.speed ?? 0;
  if (speedA > speedB) return playerIdA;
  if (speedB > speedA) return playerIdB;
  const cmp = (playerIdA || '').localeCompare(playerIdB || '');
  if (cmp < 0) return playerIdA;
  if (cmp > 0) return playerIdB;
  return (pokemonIdA ?? 0) <= (pokemonIdB ?? 0) ? playerIdA : playerIdB;
}

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
    // Re-emit battle_start when lobby is already battling (e.g. client re-sent ready or reconnected)
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
    const nextToActPlayerId = getFirstToActPlayerId(
      detailA,
      detailB,
      teamA.playerId,
      teamB.playerId,
      pokemonIdA,
      pokemonIdB
    );

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
