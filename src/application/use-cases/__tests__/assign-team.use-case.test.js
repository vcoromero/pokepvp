import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AssignTeamUseCase } from '../assign-team.use-case.js';
import { NotFoundError } from '../../errors/NotFound.error.js';
import { ConflictError } from '../../errors/Conflict.error.js';
import { ValidationError } from '../../errors/Validation.error.js';

describe('AssignTeamUseCase', () => {
  let catalogPort;
  let lobbyRepository;
  let teamRepository;
  let useCase;

  beforeEach(() => {
    catalogPort = {
      getList: jest.fn(),
    };
    lobbyRepository = {
      findById: jest.fn(),
    };
    teamRepository = {
      findByLobby: jest.fn(),
      save: jest.fn(),
    };
    useCase = new AssignTeamUseCase(
      catalogPort,
      lobbyRepository,
      teamRepository,
      { randomFn: () => 0 }
    );
  });

  it('assigns 3 random pokemon ids not already assigned in lobby', async () => {
    lobbyRepository.findById.mockResolvedValue({
      id: 'l1',
      status: 'waiting',
      playerIds: ['p1', 'p2'],
      readyPlayerIds: [],
    });
    teamRepository.findByLobby.mockResolvedValue([
      { id: 't1', lobbyId: 'l1', playerId: 'p1', pokemonIds: [1, 2, 3] },
    ]);
    catalogPort.getList.mockResolvedValue([
      { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }, { id: 7 },
    ]);
    teamRepository.save.mockImplementation(async (team) => ({ id: 't2', ...team }));

    const result = await useCase.execute({ lobbyId: 'l1', playerId: 'p2' });

    expect(teamRepository.save).toHaveBeenCalledWith({
      lobbyId: 'l1',
      playerId: 'p2',
      pokemonIds: [5, 6, 7],
    });
    expect(result.team.pokemonIds).toHaveLength(3);
    expect(result.team.pokemonIds.every((id) => ![1, 2, 3].includes(id))).toBe(true);
    expect(result.lobby).toEqual({
      id: 'l1',
      status: 'waiting',
      playerIds: ['p1', 'p2'],
      readyPlayerIds: [],
    });
  });

  it('supports catalog payload wrapped in data property', async () => {
    lobbyRepository.findById.mockResolvedValue({
      id: 'l1',
      status: 'waiting',
      playerIds: ['p1', 'p2'],
      readyPlayerIds: [],
    });
    teamRepository.findByLobby.mockResolvedValue([]);
    catalogPort.getList.mockResolvedValue({
      success: true,
      total: 6,
      data: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }],
    });
    teamRepository.save.mockImplementation(async (team) => ({ id: 't1', ...team }));

    const result = await useCase.execute({ lobbyId: 'l1', playerId: 'p1' });

    expect(result.team.pokemonIds).toHaveLength(3);
  });

  it('throws ValidationError when lobbyId or playerId is missing', async () => {
    await expect(useCase.execute({ lobbyId: '', playerId: 'p1' }))
      .rejects
      .toBeInstanceOf(ValidationError);
  });

  it('throws NotFoundError when lobby does not exist', async () => {
    lobbyRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ lobbyId: 'l1', playerId: 'p1' }))
      .rejects
      .toBeInstanceOf(NotFoundError);
  });

  it('throws NotFoundError when player is not in lobby', async () => {
    lobbyRepository.findById.mockResolvedValue({
      id: 'l1',
      status: 'waiting',
      playerIds: ['p2'],
      readyPlayerIds: [],
    });

    await expect(useCase.execute({ lobbyId: 'l1', playerId: 'p1' }))
      .rejects
      .toBeInstanceOf(NotFoundError);
  });

  it('throws ConflictError when lobby is not waiting', async () => {
    lobbyRepository.findById.mockResolvedValue({
      id: 'l1',
      status: 'ready',
      playerIds: ['p1', 'p2'],
      readyPlayerIds: [],
    });

    await expect(useCase.execute({ lobbyId: 'l1', playerId: 'p1' }))
      .rejects
      .toBeInstanceOf(ConflictError);
  });

  it('throws ConflictError when there are fewer than 3 available pokemon', async () => {
    lobbyRepository.findById.mockResolvedValue({
      id: 'l1',
      status: 'waiting',
      playerIds: ['p1', 'p2'],
      readyPlayerIds: [],
    });
    teamRepository.findByLobby.mockResolvedValue([
      { playerId: 'p1', pokemonIds: [1, 2, 3] },
    ]);
    catalogPort.getList.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]);

    await expect(useCase.execute({ lobbyId: 'l1', playerId: 'p2' }))
      .rejects
      .toBeInstanceOf(ConflictError);
  });
});
