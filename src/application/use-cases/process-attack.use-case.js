import { NotFoundError } from '../errors/NotFound.error.js';
import { ConflictError } from '../errors/Conflict.error.js';
import { ValidationError } from '../errors/Validation.error.js';
import { calculateDamage } from '../../domain/services/damage-calculator.js';

function getActivePokemon(team, statesByKey) {
  const playerId = team.playerId;
  const pokemonIds = team.pokemonIds ?? [];
  for (const pokemonId of pokemonIds) {
    const key = `${playerId}:${pokemonId}`;
    const state = statesByKey[key];
    if (state && !state.defeated) {
      return { pokemonId, state };
    }
  }
  return null;
}

export class ProcessAttackUseCase {
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

  async execute({ lobbyId, attackerPlayerId }) {
    if (!lobbyId || !attackerPlayerId) {
      throw new ValidationError('lobbyId and attackerPlayerId are required');
    }

    const lobby = await this.lobbyRepository.findById(lobbyId);
    if (!lobby) {
      throw new NotFoundError('Lobby not found');
    }
    if (lobby.status !== 'battling') {
      throw new ConflictError('Battle is not in progress');
    }

    const defenderPlayerId = (lobby.playerIds ?? []).find((id) => id !== attackerPlayerId);
    if (!defenderPlayerId) {
      throw new ValidationError('No opponent in this lobby');
    }

    const battle = await this.battleRepository.findByLobbyId(lobbyId);
    if (!battle) {
      throw new NotFoundError('Battle not found');
    }
    if (battle.winnerId) {
      throw new ConflictError('Battle already finished');
    }

    const teams = await this.teamRepository.findByLobby(lobbyId);
    const states = await this.pokemonStateRepository.findByBattleId(battle.id);
    const statesByKey = {};
    for (const s of states) {
      statesByKey[`${s.playerId}:${s.pokemonId}`] = s;
    }

    const attackerTeam = teams.find((t) => t.playerId === attackerPlayerId);
    const defenderTeam = teams.find((t) => t.playerId === defenderPlayerId);
    if (!attackerTeam || !defenderTeam) {
      throw new ValidationError('Invalid player for this lobby');
    }

    const attackerActive = getActivePokemon(attackerTeam, statesByKey);
    const defenderActive = getActivePokemon(defenderTeam, statesByKey);

    if (!attackerActive) {
      throw new ConflictError('Attacker has no available Pokémon');
    }
    if (!defenderActive) {
      throw new ConflictError('Defender has no available Pokémon; battle should already be ended');
    }

    if (battle.nextToActPlayerId !== attackerPlayerId) {
      throw new ConflictError('Not this player\'s turn');
    }

    const [attackerDetail, defenderDetail] = await Promise.all([
      this.catalogPort.getById(attackerActive.pokemonId),
      this.catalogPort.getById(defenderActive.pokemonId),
    ]);
    if (!attackerDetail || !defenderDetail) {
      throw new NotFoundError('Catalog data not found for active Pokémon');
    }

    const damage = calculateDamage(attackerDetail.attack, defenderDetail.defense);
    const previousHp = defenderActive.state.currentHp;
    const currentHp = Math.max(0, previousHp - damage);
    const defeated = currentHp === 0;

    const updatedDefenderState = {
      ...defenderActive.state,
      currentHp,
      defeated,
    };
    await this.pokemonStateRepository.save(updatedDefenderState);

    let battleFinished = false;
    let nextActivePokemon = { playerId: defenderPlayerId, pokemonId: null };

    if (defeated) {
      statesByKey[`${defenderPlayerId}:${defenderActive.pokemonId}`] = updatedDefenderState;
      let nextActiveId = null;
      for (const pid of defenderTeam.pokemonIds ?? []) {
        const st = pid === defenderActive.pokemonId
          ? updatedDefenderState
          : statesByKey[`${defenderPlayerId}:${pid}`];
        if (st && !st.defeated) {
          nextActiveId = pid;
          break;
        }
      }
      if (nextActiveId != null) {
        nextActivePokemon.pokemonId = nextActiveId;
      } else {
        battleFinished = true;
        await this.battleRepository.save({ ...battle, winnerId: attackerPlayerId });
        await this.lobbyRepository.save({ ...lobby, status: 'finished' });
      }
    }

    if (!battleFinished) {
      await this.battleRepository.save({ ...battle, nextToActPlayerId: defenderPlayerId });
    }

    const nextState = nextActivePokemon.pokemonId != null
      ? statesByKey[`${defenderPlayerId}:${nextActivePokemon.pokemonId}`]
      : null;

    const payload = {
      battleId: battle.id,
      lobbyId,
      attacker: {
        playerId: attackerPlayerId,
        pokemonId: attackerActive.pokemonId,
        name: attackerActive.state.name ?? '',
        sprite: attackerActive.state.sprite ?? '',
      },
      defender: {
        playerId: defenderPlayerId,
        pokemonId: defenderActive.pokemonId,
        name: defenderActive.state.name ?? '',
        sprite: defenderActive.state.sprite ?? '',
        damage,
        previousHp,
        currentHp,
        defeated,
      },
      nextActivePokemon: {
        playerId: nextActivePokemon.playerId,
        pokemonId: nextActivePokemon.pokemonId,
        name: nextState?.name ?? '',
        sprite: nextState?.sprite ?? '',
      },
      battleFinished,
      nextToActPlayerId: battleFinished ? undefined : defenderPlayerId,
    };

    this.realtimePort.notifyTurnResult(lobbyId, payload);
    if (battleFinished) {
      this.realtimePort.notifyBattleEnd(lobbyId, {
        battleId: battle.id,
        lobbyId,
        winnerId: attackerPlayerId,
      });
    }

    return payload;
  }
}
