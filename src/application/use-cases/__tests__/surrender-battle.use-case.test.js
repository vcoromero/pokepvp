import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SurrenderBattleUseCase } from '../surrender-battle.use-case.js';
import { ValidationError } from '../../errors/Validation.error.js';
import { NotFoundError } from '../../errors/NotFound.error.js';
import { ConflictError } from '../../errors/Conflict.error.js';

describe('SurrenderBattleUseCase', () => {
  let lobbyRepository;
  let battleRepository;
  let realtimePort;
  let useCase;

  const battlingLobby = {
    id: 'l1',
    status: 'battling',
    playerIds: ['p1', 'p2'],
    readyPlayerIds: ['p1', 'p2'],
  };

  const battle = {
    id: 'b1',
    lobbyId: 'l1',
    winnerId: null,
  };

  beforeEach(() => {
    lobbyRepository = { findById: jest.fn(), save: jest.fn() };
    battleRepository = { findByLobbyId: jest.fn(), save: jest.fn() };
    realtimePort = { notifyBattleEnd: jest.fn() };

    useCase = new SurrenderBattleUseCase(lobbyRepository, battleRepository, realtimePort);

    lobbyRepository.findById.mockResolvedValue(battlingLobby);
    battleRepository.findByLobbyId.mockResolvedValue(battle);
    battleRepository.save.mockImplementation(async (b) => b);
    lobbyRepository.save.mockImplementation(async (l) => l);
  });

  it('sets opponent as winner, finishes lobby, and notifies battle_end on surrender', async () => {
    const result = await useCase.execute({
      lobbyId: 'l1',
      surrenderingPlayerId: 'p1',
    });

    expect(battleRepository.findByLobbyId).toHaveBeenCalledWith('l1');
    expect(battleRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b1', winnerId: 'p2' })
    );

    expect(lobbyRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'l1', status: 'finished' })
    );

    expect(result).toEqual({
      battleId: 'b1',
      lobbyId: 'l1',
      winnerId: 'p2',
      loserId: 'p1',
      reason: 'surrender',
      lobby: expect.objectContaining({ id: 'l1', status: 'finished' }),
    });

    expect(realtimePort.notifyBattleEnd).toHaveBeenCalledWith(
      'l1',
      expect.objectContaining({
        battleId: 'b1',
        lobbyId: 'l1',
        winnerId: 'p2',
        loserId: 'p1',
        reason: 'surrender',
      })
    );
  });

  it('throws ValidationError when required input is missing', async () => {
    await expect(
      useCase.execute({ lobbyId: 'l1' })
    ).rejects.toThrow(ValidationError);

    await expect(
      useCase.execute({ surrenderingPlayerId: 'p1' })
    ).rejects.toThrow(ValidationError);
  });

  it('throws NotFoundError when lobby does not exist', async () => {
    lobbyRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ lobbyId: 'l1', surrenderingPlayerId: 'p1' })
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError when player is not in lobby', async () => {
    lobbyRepository.findById.mockResolvedValue({
      ...battlingLobby,
      playerIds: ['p1'],
    });

    await expect(
      useCase.execute({ lobbyId: 'l1', surrenderingPlayerId: 'p2' })
    ).rejects.toThrow(ValidationError);
  });

  it('throws ConflictError when lobby is not battling', async () => {
    lobbyRepository.findById.mockResolvedValue({
      ...battlingLobby,
      status: 'ready',
    });

    await expect(
      useCase.execute({ lobbyId: 'l1', surrenderingPlayerId: 'p1' })
    ).rejects.toThrow(ConflictError);
  });

  it('throws NotFoundError when battle does not exist', async () => {
    battleRepository.findByLobbyId.mockResolvedValue(null);

    await expect(
      useCase.execute({ lobbyId: 'l1', surrenderingPlayerId: 'p1' })
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ConflictError when battle already has a winner', async () => {
    battleRepository.findByLobbyId.mockResolvedValue({
      ...battle,
      winnerId: 'p2',
    });

    await expect(
      useCase.execute({ lobbyId: 'l1', surrenderingPlayerId: 'p1' })
    ).rejects.toThrow(ConflictError);
  });
}
);

