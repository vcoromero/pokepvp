import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { StartBattleUseCase } from '../start-battle.use-case.js';
import { ValidationError } from '../../errors/Validation.error.js';
import { NotFoundError } from '../../errors/NotFound.error.js';
import { ConflictError } from '../../errors/Conflict.error.js';

describe('StartBattleUseCase', () => {
  let lobbyRepository;
  let teamRepository;
  let battleRepository;
  let pokemonStateRepository;
  let catalogPort;
  let realtimePort;
  let useCase;

  const readyLobby = {
    id: 'l1',
    status: 'ready',
    playerIds: ['p1', 'p2'],
    readyPlayerIds: ['p1', 'p2'],
  };

  const twoTeams = [
    { id: 't1', lobbyId: 'l1', playerId: 'p1', pokemonIds: [1, 2, 3] },
    { id: 't2', lobbyId: 'l1', playerId: 'p2', pokemonIds: [4, 5, 6] },
  ];

  beforeEach(() => {
    lobbyRepository = { findById: jest.fn(), save: jest.fn() };
    teamRepository = { findByLobby: jest.fn() };
    battleRepository = { findByLobbyId: jest.fn(), save: jest.fn() };
    pokemonStateRepository = { findByBattleId: jest.fn(), saveMany: jest.fn() };
    catalogPort = { getById: jest.fn() };
    realtimePort = { notifyBattleStart: jest.fn() };

    useCase = new StartBattleUseCase(
      lobbyRepository,
      teamRepository,
      battleRepository,
      pokemonStateRepository,
      catalogPort,
      realtimePort
    );

    lobbyRepository.findById.mockResolvedValue(readyLobby);
    teamRepository.findByLobby.mockResolvedValue(twoTeams);
    battleRepository.findByLobbyId.mockResolvedValue(null);
    battleRepository.save.mockResolvedValue({
      id: 'b1',
      lobbyId: 'l1',
      startedAt: new Date(),
      winnerId: null,
      nextToActPlayerId: 'p1',
    });
    catalogPort.getById.mockImplementation((id) =>
      Promise.resolve({ id, hp: 40, attack: 50, defense: 50, speed: 30 })
    );
    pokemonStateRepository.saveMany.mockResolvedValue([
      { battleId: 'b1', pokemonId: 1, playerId: 'p1', currentHp: 40, defeated: false },
      { battleId: 'b1', pokemonId: 2, playerId: 'p1', currentHp: 40, defeated: false },
      { battleId: 'b1', pokemonId: 3, playerId: 'p1', currentHp: 40, defeated: false },
      { battleId: 'b1', pokemonId: 4, playerId: 'p2', currentHp: 40, defeated: false },
      { battleId: 'b1', pokemonId: 5, playerId: 'p2', currentHp: 40, defeated: false },
      { battleId: 'b1', pokemonId: 6, playerId: 'p2', currentHp: 40, defeated: false },
    ]);
    lobbyRepository.save.mockResolvedValue({ ...readyLobby, status: 'battling' });
  });

  it('throws NotFoundError when lobby does not exist', async () => {
    lobbyRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ lobbyId: 'l1' })).rejects.toThrow(NotFoundError);
    expect(realtimePort.notifyBattleStart).not.toHaveBeenCalled();
  });

  it('throws ConflictError when lobby is not ready', async () => {
    lobbyRepository.findById.mockResolvedValue({ ...readyLobby, status: 'waiting' });

    await expect(useCase.execute({ lobbyId: 'l1' })).rejects.toThrow(ConflictError);
    expect(realtimePort.notifyBattleStart).not.toHaveBeenCalled();
  });

  it('throws ValidationError when lobby does not have exactly two teams', async () => {
    teamRepository.findByLobby.mockResolvedValue([twoTeams[0]]);

    await expect(useCase.execute({ lobbyId: 'l1' })).rejects.toThrow(ValidationError);
    expect(realtimePort.notifyBattleStart).not.toHaveBeenCalled();
  });

  it('throws ValidationError when a team does not have exactly 3 Pokémon', async () => {
    teamRepository.findByLobby.mockResolvedValue([
      { ...twoTeams[0], pokemonIds: [1, 2] },
      twoTeams[1],
    ]);

    await expect(useCase.execute({ lobbyId: 'l1' })).rejects.toThrow(ValidationError);
    expect(realtimePort.notifyBattleStart).not.toHaveBeenCalled();
  });

  it('creates battle, initializes 6 pokemon states with full HP, and notifies battle start', async () => {
    const result = await useCase.execute({ lobbyId: 'l1' });

    expect(battleRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        lobbyId: 'l1',
        winnerId: null,
        nextToActPlayerId: 'p1',
      })
    );
    expect(catalogPort.getById).toHaveBeenCalledTimes(8);
    expect(pokemonStateRepository.saveMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          battleId: 'b1',
          pokemonId: 1,
          playerId: 'p1',
          currentHp: 40,
          defeated: false,
        }),
        expect.objectContaining({
          battleId: 'b1',
          pokemonId: 6,
          playerId: 'p2',
          currentHp: 40,
          defeated: false,
        }),
      ])
    );
    expect(lobbyRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'l1', status: 'battling' })
    );
    expect(realtimePort.notifyBattleStart).toHaveBeenCalledWith('l1', {
      battle: expect.any(Object),
      pokemonStates: expect.any(Array),
    });
    expect(result.battle).toBeDefined();
    expect(result.pokemonStates).toHaveLength(6);
  });

  it('is idempotent: returns existing battle and states when battle already exists without winner', async () => {
    const existingBattle = { id: 'b0', lobbyId: 'l1', winnerId: null, nextToActPlayerId: 'p2' };
    const existingStates = [
      { battleId: 'b0', pokemonId: 1, playerId: 'p1', currentHp: 40, defeated: false },
    ];
    battleRepository.findByLobbyId.mockResolvedValue(existingBattle);
    pokemonStateRepository.findByBattleId.mockResolvedValue(existingStates);

    const result = await useCase.execute({ lobbyId: 'l1' });

    expect(battleRepository.save).not.toHaveBeenCalled();
    expect(pokemonStateRepository.saveMany).not.toHaveBeenCalled();
    expect(catalogPort.getById).not.toHaveBeenCalled();
    expect(realtimePort.notifyBattleStart).toHaveBeenCalledWith('l1', {
      battle: existingBattle,
      pokemonStates: existingStates,
    });
    expect(result.battle).toEqual(existingBattle);
    expect(result.pokemonStates).toEqual(existingStates);
  });

  it('throws ValidationError when lobbyId is missing', async () => {
    await expect(useCase.execute({})).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when catalog has no hp for a Pokémon', async () => {
    let callCount = 0;
    catalogPort.getById.mockImplementation((id) => {
      callCount += 1;
      const full = { id, hp: 40, attack: 50, defense: 50, speed: 30 };
      if (callCount > 2 && id === 1) return Promise.resolve({ id: 1 });
      return Promise.resolve(full);
    });

    await expect(useCase.execute({ lobbyId: 'l1' })).rejects.toThrow(ValidationError);
  });

  it('sets nextToActPlayerId to player whose initial active Pokémon has higher Speed', async () => {
    catalogPort.getById.mockImplementation((id) =>
      Promise.resolve({
        id,
        hp: 40,
        attack: 50,
        defense: 50,
        speed: id === 4 ? 60 : 30,
      })
    );

    await useCase.execute({ lobbyId: 'l1' });

    expect(battleRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        nextToActPlayerId: 'p2',
      })
    );
  });

  it('re-emits battle_start when lobby is already battling with an active battle', async () => {
    lobbyRepository.findById.mockResolvedValue({ ...readyLobby, status: 'battling' });
    const existingBattle = { id: 'b0', lobbyId: 'l1', winnerId: null, nextToActPlayerId: 'p2' };
    const existingStates = [
      { battleId: 'b0', pokemonId: 1, playerId: 'p1', currentHp: 40, defeated: false },
    ];
    battleRepository.findByLobbyId.mockResolvedValue(existingBattle);
    pokemonStateRepository.findByBattleId.mockResolvedValue(existingStates);

    const result = await useCase.execute({ lobbyId: 'l1' });

    expect(teamRepository.findByLobby).not.toHaveBeenCalled();
    expect(battleRepository.save).not.toHaveBeenCalled();
    expect(realtimePort.notifyBattleStart).toHaveBeenCalledWith('l1', {
      battle: existingBattle,
      pokemonStates: existingStates,
    });
    expect(result.battle).toEqual(existingBattle);
  });

  it('throws ConflictError when lobby is battling but battle has a winner', async () => {
    lobbyRepository.findById.mockResolvedValue({ ...readyLobby, status: 'battling' });
    battleRepository.findByLobbyId.mockResolvedValue({ id: 'b0', lobbyId: 'l1', winnerId: 'p1' });

    await expect(useCase.execute({ lobbyId: 'l1' })).rejects.toThrow(ConflictError);
  });
});
