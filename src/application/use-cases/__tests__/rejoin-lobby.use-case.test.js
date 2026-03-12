import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RejoinLobbyUseCase } from '../rejoin-lobby.use-case.js';
import { ValidationError } from '../../errors/Validation.error.js';
import { NotFoundError } from '../../errors/NotFound.error.js';
import { ConflictError } from '../../errors/Conflict.error.js';

describe('RejoinLobbyUseCase', () => {
  let playerRepository;
  let lobbyRepository;
  let useCase;

  beforeEach(() => {
    playerRepository = { findById: jest.fn() };
    lobbyRepository = { findById: jest.fn() };
    useCase = new RejoinLobbyUseCase(playerRepository, lobbyRepository);
  });

  it('returns player and lobby when player belongs to waiting lobby', async () => {
    const player = { id: 'p1', nickname: 'Ash', lobbyId: 'l1' };
    const lobby = { id: 'l1', status: 'waiting', playerIds: ['p1', 'p2'], readyPlayerIds: [] };
    playerRepository.findById.mockResolvedValue(player);
    lobbyRepository.findById.mockResolvedValue(lobby);

    const result = await useCase.execute({ playerId: 'p1', lobbyId: 'l1' });

    expect(result).toEqual({ player, lobby });
    expect(playerRepository.findById).toHaveBeenCalledWith('p1');
    expect(lobbyRepository.findById).toHaveBeenCalledWith('l1');
  });

  it('returns player and lobby when player belongs to battling lobby', async () => {
    const player = { id: 'p1', nickname: 'Ash', lobbyId: 'l1' };
    const lobby = { id: 'l1', status: 'battling', playerIds: ['p1', 'p2'], readyPlayerIds: ['p1', 'p2'] };
    playerRepository.findById.mockResolvedValue(player);
    lobbyRepository.findById.mockResolvedValue(lobby);

    const result = await useCase.execute({ playerId: 'p1', lobbyId: 'l1' });

    expect(result).toEqual({ player, lobby });
  });

  it('returns player and lobby when lobby status is ready', async () => {
    const player = { id: 'p2', nickname: 'Misty', lobbyId: 'l1' };
    const lobby = { id: 'l1', status: 'ready', playerIds: ['p1', 'p2'], readyPlayerIds: ['p1', 'p2'] };
    playerRepository.findById.mockResolvedValue(player);
    lobbyRepository.findById.mockResolvedValue(lobby);

    const result = await useCase.execute({ playerId: 'p2', lobbyId: 'l1' });

    expect(result).toEqual({ player, lobby });
  });

  it('throws ValidationError when playerId is missing', async () => {
    await expect(useCase.execute({ lobbyId: 'l1' }))
      .rejects.toThrow(ValidationError);
    await expect(useCase.execute({ playerId: '', lobbyId: 'l1' }))
      .rejects.toThrow('playerId and lobbyId are required');
  });

  it('throws ValidationError when lobbyId is missing', async () => {
    await expect(useCase.execute({ playerId: 'p1' }))
      .rejects.toThrow(ValidationError);
    await expect(useCase.execute({ playerId: 'p1', lobbyId: '' }))
      .rejects.toThrow('playerId and lobbyId are required');
  });

  it('throws NotFoundError when player does not exist', async () => {
    playerRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ playerId: 'p99', lobbyId: 'l1' }))
      .rejects.toThrow(NotFoundError);
    await expect(useCase.execute({ playerId: 'p99', lobbyId: 'l1' }))
      .rejects.toThrow('Player not found');
  });

  it('throws ConflictError when player lobbyId does not match', async () => {
    playerRepository.findById.mockResolvedValue({ id: 'p1', nickname: 'Ash', lobbyId: 'l2' });

    await expect(useCase.execute({ playerId: 'p1', lobbyId: 'l1' }))
      .rejects.toThrow(ConflictError);
    await expect(useCase.execute({ playerId: 'p1', lobbyId: 'l1' }))
      .rejects.toThrow('Player does not belong to this lobby');
  });

  it('throws NotFoundError when lobby does not exist', async () => {
    playerRepository.findById.mockResolvedValue({ id: 'p1', nickname: 'Ash', lobbyId: 'l1' });
    lobbyRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ playerId: 'p1', lobbyId: 'l1' }))
      .rejects.toThrow(NotFoundError);
    await expect(useCase.execute({ playerId: 'p1', lobbyId: 'l1' }))
      .rejects.toThrow('Lobby not found');
  });

  it('throws NotFoundError when player is not in lobby playerIds', async () => {
    playerRepository.findById.mockResolvedValue({ id: 'p1', nickname: 'Ash', lobbyId: 'l1' });
    lobbyRepository.findById.mockResolvedValue({ id: 'l1', status: 'waiting', playerIds: ['p2', 'p3'], readyPlayerIds: [] });

    await expect(useCase.execute({ playerId: 'p1', lobbyId: 'l1' }))
      .rejects.toThrow(NotFoundError);
    await expect(useCase.execute({ playerId: 'p1', lobbyId: 'l1' }))
      .rejects.toThrow('Player is not in this lobby');
  });

  it('throws ConflictError when lobby status is finished', async () => {
    playerRepository.findById.mockResolvedValue({ id: 'p1', nickname: 'Ash', lobbyId: 'l1' });
    lobbyRepository.findById.mockResolvedValue({ id: 'l1', status: 'finished', playerIds: ['p1', 'p2'], readyPlayerIds: ['p1', 'p2'] });

    await expect(useCase.execute({ playerId: 'p1', lobbyId: 'l1' }))
      .rejects.toThrow(ConflictError);
    await expect(useCase.execute({ playerId: 'p1', lobbyId: 'l1' }))
      .rejects.toThrow('Cannot rejoin: lobby is finished or invalid');
  });
});
