import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { JoinLobbyUseCase } from '../join-lobby.use-case.js';
import { ValidationError } from '../../errors/Validation.error.js';
import { ConflictError } from '../../errors/Conflict.error.js';

describe('JoinLobbyUseCase', () => {
  let playerRepository;
  let lobbyRepository;
  let useCase;

  beforeEach(() => {
    playerRepository = {
      save: jest.fn(),
    };
    lobbyRepository = {
      findActive: jest.fn(),
      save: jest.fn(),
    };
    useCase = new JoinLobbyUseCase(playerRepository, lobbyRepository);
  });

  it('creates lobby and player when there is no active lobby', async () => {
    lobbyRepository.findActive.mockResolvedValue(null);
    lobbyRepository.save
      .mockResolvedValueOnce({ id: 'l1', status: 'waiting', playerIds: [], readyPlayerIds: [] })
      .mockResolvedValueOnce({ id: 'l1', status: 'waiting', playerIds: ['p1'], readyPlayerIds: [] });
    playerRepository.save.mockResolvedValue({ id: 'p1', nickname: 'Ash', lobbyId: 'l1' });

    const result = await useCase.execute({ nickname: '  Ash  ' });

    expect(lobbyRepository.save).toHaveBeenNthCalledWith(1, {
      status: 'waiting',
      playerIds: [],
      readyPlayerIds: [],
    });
    expect(playerRepository.save).toHaveBeenCalledWith({ nickname: 'Ash', lobbyId: 'l1' });
    expect(lobbyRepository.save).toHaveBeenNthCalledWith(2, {
      id: 'l1',
      status: 'waiting',
      playerIds: ['p1'],
      readyPlayerIds: [],
    });
    expect(result).toEqual({
      player: { id: 'p1', nickname: 'Ash', lobbyId: 'l1' },
      lobby: { id: 'l1', status: 'waiting', playerIds: ['p1'], readyPlayerIds: [] },
    });
  });

  it('adds player to existing waiting lobby with one player', async () => {
    lobbyRepository.findActive.mockResolvedValue({
      id: 'l1',
      status: 'waiting',
      playerIds: ['p1'],
      readyPlayerIds: [],
    });
    playerRepository.save.mockResolvedValue({ id: 'p2', nickname: 'Misty', lobbyId: 'l1' });
    lobbyRepository.save.mockResolvedValue({
      id: 'l1',
      status: 'waiting',
      playerIds: ['p1', 'p2'],
      readyPlayerIds: [],
    });

    const result = await useCase.execute({ nickname: 'Misty' });

    expect(playerRepository.save).toHaveBeenCalledWith({ nickname: 'Misty', lobbyId: 'l1' });
    expect(lobbyRepository.save).toHaveBeenCalledWith({
      id: 'l1',
      status: 'waiting',
      playerIds: ['p1', 'p2'],
      readyPlayerIds: [],
    });
    expect(result.lobby.playerIds).toEqual(['p1', 'p2']);
  });

  it('throws ConflictError when lobby is full', async () => {
    lobbyRepository.findActive.mockResolvedValue({
      id: 'l1',
      status: 'waiting',
      playerIds: ['p1', 'p2'],
      readyPlayerIds: [],
    });

    await expect(useCase.execute({ nickname: 'Brock' }))
      .rejects
      .toBeInstanceOf(ConflictError);
  });

  it('throws ConflictError when active lobby is not waiting', async () => {
    lobbyRepository.findActive.mockResolvedValue({
      id: 'l1',
      status: 'battling',
      playerIds: ['p1'],
      readyPlayerIds: [],
    });

    await expect(useCase.execute({ nickname: 'Brock' }))
      .rejects
      .toBeInstanceOf(ConflictError);
  });

  it('throws ValidationError for empty nickname', async () => {
    await expect(useCase.execute({ nickname: '   ' }))
      .rejects
      .toBeInstanceOf(ValidationError);
  });
});
