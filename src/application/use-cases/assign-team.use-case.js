import { ValidationError } from '../errors/Validation.error.js';
import { NotFoundError } from '../errors/NotFound.error.js';
import { ConflictError } from '../errors/Conflict.error.js';

function buildUniqueCatalogIds(catalogList) {
  const ids = [];
  const seen = new Set();

  for (const item of catalogList) {
    const parsedId = Number(item?.id);
    if (!Number.isFinite(parsedId) || seen.has(parsedId)) {
      continue;
    }
    seen.add(parsedId);
    ids.push(parsedId);
  }

  return ids;
}

function normalizeCatalogList(catalogPayload) {
  if (Array.isArray(catalogPayload)) {
    return catalogPayload;
  }

  if (Array.isArray(catalogPayload?.data)) {
    return catalogPayload.data;
  }

  return [];
}

function pickRandomDistinct(ids, count, randomFn) {
  const pool = [...ids];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(randomFn() * (i + 1));
    [pool[i], pool[randomIndex]] = [pool[randomIndex], pool[i]];
  }
  return pool.slice(0, count);
}

export class AssignTeamUseCase {
  constructor(catalogPort, lobbyRepository, teamRepository, options = {}) {
    this.catalogPort = catalogPort;
    this.lobbyRepository = lobbyRepository;
    this.teamRepository = teamRepository;
    this.randomFn = options.randomFn ?? Math.random;
  }

  async execute({ lobbyId, playerId }) {
    if (!lobbyId || !playerId) {
      throw new ValidationError('lobbyId and playerId are required');
    }

    const lobby = await this.lobbyRepository.findById(lobbyId);
    if (!lobby) {
      throw new NotFoundError('Lobby not found');
    }
    if (lobby.status !== 'waiting') {
      throw new ConflictError('Teams can only be assigned when lobby is waiting');
    }
    if (!(lobby.playerIds ?? []).includes(playerId)) {
      throw new NotFoundError('Player is not in this lobby');
    }

    const existingTeams = await this.teamRepository.findByLobby(lobbyId);
    const assignedPokemon = new Set(
      existingTeams.flatMap((team) => team.pokemonIds ?? [])
    );

    const catalogPayload = await this.catalogPort.getList();
    const catalogList = normalizeCatalogList(catalogPayload);
    const availableCatalogIds = buildUniqueCatalogIds(catalogList)
      .filter((pokemonId) => !assignedPokemon.has(pokemonId));

    if (availableCatalogIds.length < 3) {
      throw new ConflictError('Not enough available Pokémon to assign a team');
    }

    const pokemonIds = pickRandomDistinct(availableCatalogIds, 3, this.randomFn);
    const team = await this.teamRepository.save({ lobbyId, playerId, pokemonIds });
    return { team, lobby };
  }
}
