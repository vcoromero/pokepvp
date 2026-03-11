import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ProcessAttackUseCase } from '../process-attack.use-case.js';
import { ValidationError } from '../../errors/Validation.error.js';
import { NotFoundError } from '../../errors/NotFound.error.js';
import { ConflictError } from '../../errors/Conflict.error.js';

describe('ProcessAttackUseCase', () => {
  let lobbyRepository;
  let teamRepository;
  let battleRepository;
  let pokemonStateRepository;
  let catalogPort;
  let realtimePort;
  let useCase;

  const battlingLobby = {
    id: 'l1',
    status: 'battling',
    playerIds: ['p1', 'p2'],
  };

  const teams = [
    { lobbyId: 'l1', playerId: 'p1', pokemonIds: [1, 2, 3] },
    { lobbyId: 'l1', playerId: 'p2', pokemonIds: [4, 5, 6] },
  ];

  const battle = { id: 'b1', lobbyId: 'l1', winnerId: null, nextToActPlayerId: 'p1' };

  const defaultStates = [
    { id: 's1', battleId: 'b1', pokemonId: 1, playerId: 'p1', currentHp: 40, defeated: false },
    { id: 's2', battleId: 'b1', pokemonId: 2, playerId: 'p1', currentHp: 40, defeated: false },
    { id: 's3', battleId: 'b1', pokemonId: 3, playerId: 'p1', currentHp: 40, defeated: false },
    { id: 's4', battleId: 'b1', pokemonId: 4, playerId: 'p2', currentHp: 30, defeated: false },
    { id: 's5', battleId: 'b1', pokemonId: 5, playerId: 'p2', currentHp: 40, defeated: false },
    { id: 's6', battleId: 'b1', pokemonId: 6, playerId: 'p2', currentHp: 40, defeated: false },
  ];

  beforeEach(() => {
    lobbyRepository = { findById: jest.fn(), save: jest.fn() };
    teamRepository = { findByLobby: jest.fn() };
    battleRepository = { findByLobbyId: jest.fn(), save: jest.fn() };
    pokemonStateRepository = { findByBattleId: jest.fn(), save: jest.fn() };
    catalogPort = { getById: jest.fn() };
    realtimePort = { notifyTurnResult: jest.fn(), notifyBattleEnd: jest.fn() };

    useCase = new ProcessAttackUseCase(
      lobbyRepository,
      teamRepository,
      battleRepository,
      pokemonStateRepository,
      catalogPort,
      realtimePort
    );

    lobbyRepository.findById.mockResolvedValue(battlingLobby);
    teamRepository.findByLobby.mockResolvedValue(teams);
    battleRepository.findByLobbyId.mockResolvedValue(battle);
    pokemonStateRepository.findByBattleId.mockResolvedValue(defaultStates);
    catalogPort.getById.mockImplementation((id) => {
      const attack = id === 1 ? 60 : 50;
      const defense = 40;
      const speed = id === 1 ? 50 : 30;
      return Promise.resolve({ id, hp: 40, attack, defense, speed });
    });
    pokemonStateRepository.save.mockResolvedValue({});
    battleRepository.save.mockResolvedValue({ ...battle, winnerId: 'p1' });
    lobbyRepository.save.mockResolvedValue({ ...battlingLobby, status: 'finished' });
  });

  it('resolves defender from lobby playerIds and applies damage', async () => {
    const result = await useCase.execute({
      lobbyId: 'l1',
      attackerPlayerId: 'p1',
    });

    expect(pokemonStateRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        playerId: 'p2',
        pokemonId: 4,
        currentHp: 10,
        defeated: false,
      })
    );
    expect(result.defender.damage).toBe(20);
    expect(result.defender.previousHp).toBe(30);
    expect(result.defender.currentHp).toBe(10);
    expect(result.defender.defeated).toBe(false);
    expect(result.battleFinished).toBe(false);
    expect(result.nextActivePokemon.pokemonId).toBe(null);
    expect(result.nextToActPlayerId).toBe('p2');
    expect(battleRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ nextToActPlayerId: 'p2' })
    );
    expect(realtimePort.notifyTurnResult).toHaveBeenCalledWith('l1', result);
    expect(realtimePort.notifyBattleEnd).not.toHaveBeenCalled();
  });

  it('applies minimum damage of 1 when attack - defense < 1', async () => {
    catalogPort.getById.mockImplementation((id) =>
      Promise.resolve({
        id,
        attack: id === 1 ? 10 : 5,
        defense: id === 4 ? 100 : 40,
        speed: id === 1 ? 50 : 30,
      })
    );

    const result = await useCase.execute({
      lobbyId: 'l1',
      attackerPlayerId: 'p1',
    });

    expect(result.defender.damage).toBe(1);
    expect(pokemonStateRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        currentHp: 29,
        defeated: false,
      })
    );
  });

  it('marks defender defeated and sets nextActivePokemon when defender has another Pokémon', async () => {
    pokemonStateRepository.findByBattleId.mockResolvedValue([
      { id: 's1', battleId: 'b1', pokemonId: 1, playerId: 'p1', currentHp: 40, defeated: false },
      { id: 's2', battleId: 'b1', pokemonId: 2, playerId: 'p1', currentHp: 40, defeated: false },
      { id: 's3', battleId: 'b1', pokemonId: 3, playerId: 'p1', currentHp: 40, defeated: false },
      { id: 's4', battleId: 'b1', pokemonId: 4, playerId: 'p2', currentHp: 1, defeated: false },
      { id: 's5', battleId: 'b1', pokemonId: 5, playerId: 'p2', currentHp: 40, defeated: false },
      { id: 's6', battleId: 'b1', pokemonId: 6, playerId: 'p2', currentHp: 40, defeated: false },
    ]);
    catalogPort.getById.mockImplementation((id) =>
      Promise.resolve({ id, attack: 50, defense: 0, speed: id === 1 ? 50 : 30 })
    );

    const result = await useCase.execute({
      lobbyId: 'l1',
      attackerPlayerId: 'p1',
    });

    expect(result.defender.defeated).toBe(true);
    expect(result.defender.currentHp).toBe(0);
    expect(result.nextActivePokemon).toEqual({ playerId: 'p2', pokemonId: 5, name: '', sprite: '' });
    expect(result.battleFinished).toBe(false);
    expect(realtimePort.notifyBattleEnd).not.toHaveBeenCalled();
  });

  it('ends battle and notifies battle_end when defender has no remaining Pokémon', async () => {
    pokemonStateRepository.findByBattleId.mockResolvedValue([
      { id: 's1', battleId: 'b1', pokemonId: 1, playerId: 'p1', currentHp: 40, defeated: false },
      { id: 's2', battleId: 'b1', pokemonId: 2, playerId: 'p1', currentHp: 40, defeated: false },
      { id: 's3', battleId: 'b1', pokemonId: 3, playerId: 'p1', currentHp: 40, defeated: false },
      { id: 's4', battleId: 'b1', pokemonId: 4, playerId: 'p2', currentHp: 1, defeated: false },
      { id: 's5', battleId: 'b1', pokemonId: 5, playerId: 'p2', currentHp: 0, defeated: true },
      { id: 's6', battleId: 'b1', pokemonId: 6, playerId: 'p2', currentHp: 0, defeated: true },
    ]);
    catalogPort.getById.mockImplementation((id) =>
      Promise.resolve({ id, attack: 50, defense: 0, speed: id === 1 ? 50 : 30 })
    );

    const result = await useCase.execute({
      lobbyId: 'l1',
      attackerPlayerId: 'p1',
    });

    expect(result.battleFinished).toBe(true);
    expect(result.nextActivePokemon.pokemonId).toBe(null);
    expect(battleRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ winnerId: 'p1' })
    );
    expect(lobbyRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'finished' })
    );
    expect(realtimePort.notifyBattleEnd).toHaveBeenCalledWith('l1', {
      battleId: 'b1',
      lobbyId: 'l1',
      winnerId: 'p1',
    });
  });

  it('throws ConflictError when not attacker\'s turn', async () => {
    battleRepository.findByLobbyId.mockResolvedValue({ ...battle, nextToActPlayerId: 'p2' });

    await expect(
      useCase.execute({
        lobbyId: 'l1',
        attackerPlayerId: 'p1',
      })
    ).rejects.toThrow(ConflictError);

    expect(pokemonStateRepository.save).not.toHaveBeenCalled();
    expect(realtimePort.notifyTurnResult).not.toHaveBeenCalled();
  });

  it('throws ConflictError when battle already finished', async () => {
    battleRepository.findByLobbyId.mockResolvedValue({ ...battle, winnerId: 'p1' });

    await expect(
      useCase.execute({
        lobbyId: 'l1',
        attackerPlayerId: 'p1',
      })
    ).rejects.toThrow(ConflictError);
  });

  it('throws ConflictError when lobby is not battling', async () => {
    lobbyRepository.findById.mockResolvedValue({ ...battlingLobby, status: 'ready' });

    await expect(
      useCase.execute({
        lobbyId: 'l1',
        attackerPlayerId: 'p1',
      })
    ).rejects.toThrow(ConflictError);
  });

  it('throws NotFoundError when lobby does not exist', async () => {
    lobbyRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        lobbyId: 'l1',
        attackerPlayerId: 'p1',
      })
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when battle does not exist', async () => {
    battleRepository.findByLobbyId.mockResolvedValue(null);

    await expect(
      useCase.execute({
        lobbyId: 'l1',
        attackerPlayerId: 'p1',
      })
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ConflictError when attacker has no available Pokémon', async () => {
    pokemonStateRepository.findByBattleId.mockResolvedValue([
      { id: 's1', battleId: 'b1', pokemonId: 1, playerId: 'p1', currentHp: 0, defeated: true },
      { id: 's2', battleId: 'b1', pokemonId: 2, playerId: 'p1', currentHp: 0, defeated: true },
      { id: 's3', battleId: 'b1', pokemonId: 3, playerId: 'p1', currentHp: 0, defeated: true },
      ...defaultStates.slice(3),
    ]);

    await expect(
      useCase.execute({
        lobbyId: 'l1',
        attackerPlayerId: 'p1',
      })
    ).rejects.toThrow(ConflictError);
  });

  it('throws ValidationError when required input is missing', async () => {
    await expect(useCase.execute({ lobbyId: 'l1' })).rejects.toThrow(ValidationError);
    await expect(useCase.execute({ attackerPlayerId: 'p1' })).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when attacker is alone in lobby', async () => {
    lobbyRepository.findById.mockResolvedValue({
      ...battlingLobby,
      playerIds: ['p1'],
    });

    await expect(
      useCase.execute({
        lobbyId: 'l1',
        attackerPlayerId: 'p1',
      })
    ).rejects.toThrow(ValidationError);
  });

  it('allows defender to attack on next turn (alternation)', async () => {
    const result1 = await useCase.execute({
      lobbyId: 'l1',
      attackerPlayerId: 'p1',
    });
    expect(result1.nextToActPlayerId).toBe('p2');

    battleRepository.findByLobbyId.mockResolvedValue({
      ...battle,
      nextToActPlayerId: 'p2',
    });

    const result2 = await useCase.execute({
      lobbyId: 'l1',
      attackerPlayerId: 'p2',
    });

    expect(result2.attacker.playerId).toBe('p2');
    expect(battleRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ nextToActPlayerId: 'p1' })
    );
    expect(realtimePort.notifyTurnResult).toHaveBeenCalledTimes(2);
  });
});
