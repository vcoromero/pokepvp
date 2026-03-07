import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MarkReadyUseCase } from '../mark-ready.use-case.js';
import { ValidationError } from '../../errors/Validation.error.js';
import { NotFoundError } from '../../errors/NotFound.error.js';

describe('MarkReadyUseCase', () => {
  let lobbyRepository;
  let teamRepository;
  let useCase;

  beforeEach(() => {
    lobbyRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    };
    teamRepository = {
      findByLobbyAndPlayer: jest.fn(),
    };
    useCase = new MarkReadyUseCase(lobbyRepository, teamRepository);
  });

  it('adds player to ready list and keeps waiting when only one ready', async () => {
    lobbyRepository.findById.mockResolvedValue({
      id: 'l1',
      status: 'waiting',
      playerIds: ['p1', 'p2'],
      readyPlayerIds: [],
    });
    teamRepository.findByLobbyAndPlayer.mockResolvedValue({ id: 't1' });
    lobbyRepository.save.mockResolvedValue({
      id: 'l1',
      status: 'waiting',
      playerIds: ['p1', 'p2'],
      readyPlayerIds: ['p1'],
    });

    const result = await useCase.execute({ lobbyId: 'l1', playerId: 'p1' });

    expect(lobbyRepository.save).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('waiting');
    expect(result.readyPlayerIds).toEqual(['p1']);
  });

  it('changes status to ready when both players are ready', async () => {
    lobbyRepository.findById.mockResolvedValue({
      id: 'l1',
      status: 'waiting',
      playerIds: ['p1', 'p2'],
      readyPlayerIds: ['p1'],
    });
    teamRepository.findByLobbyAndPlayer.mockResolvedValue({ id: 't2' });
    lobbyRepository.save
      .mockResolvedValueOnce({
        id: 'l1',
        status: 'waiting',
        playerIds: ['p1', 'p2'],
        readyPlayerIds: ['p1', 'p2'],
      })
      .mockResolvedValueOnce({
        id: 'l1',
        status: 'ready',
        playerIds: ['p1', 'p2'],
        readyPlayerIds: ['p1', 'p2'],
      });

    const result = await useCase.execute({ lobbyId: 'l1', playerId: 'p2' });

    expect(lobbyRepository.save).toHaveBeenNthCalledWith(2, {
      id: 'l1',
      status: 'ready',
      playerIds: ['p1', 'p2'],
      readyPlayerIds: ['p1', 'p2'],
    });
    expect(result.status).toBe('ready');
  });

  it('returns unchanged lobby when player was already ready', async () => {
    const lobby = {
      id: 'l1',
      status: 'waiting',
      playerIds: ['p1', 'p2'],
      readyPlayerIds: ['p1'],
    };
    lobbyRepository.findById.mockResolvedValue(lobby);
    teamRepository.findByLobbyAndPlayer.mockResolvedValue({ id: 't1' });

    const result = await useCase.execute({ lobbyId: 'l1', playerId: 'p1' });

    expect(lobbyRepository.save).not.toHaveBeenCalled();
    expect(result).toEqual(lobby);
  });

  it('throws ValidationError when player has no assigned team', async () => {
    lobbyRepository.findById.mockResolvedValue({
      id: 'l1',
      status: 'waiting',
      playerIds: ['p1', 'p2'],
      readyPlayerIds: [],
    });
    teamRepository.findByLobbyAndPlayer.mockResolvedValue(null);

    await expect(useCase.execute({ lobbyId: 'l1', playerId: 'p1' }))
      .rejects
      .toBeInstanceOf(ValidationError);
  });

  it('throws NotFoundError when lobby does not exist', async () => {
    lobbyRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ lobbyId: 'l1', playerId: 'p1' }))
      .rejects
      .toBeInstanceOf(NotFoundError);
  });

  it('throws NotFoundError when player does not belong to lobby', async () => {
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
});
