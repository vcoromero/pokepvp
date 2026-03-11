import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SocketHandler } from '../socket.handler.js';
import { ValidationError } from '../../../application/errors/Validation.error.js';
import { NotFoundError } from '../../../application/errors/NotFound.error.js';
import { ConflictError } from '../../../application/errors/Conflict.error.js';

function createMockSocket() {
  const handlers = {};
  return {
    on: jest.fn((event, fn) => {
      handlers[event] = fn;
    }),
    join: jest.fn(),
    emit: jest.fn(),
    data: {},
    rooms: new Set(),
    _trigger: (event, ...args) => handlers[event]?.(...args),
  };
}

function createMockIo() {
  let connectionCb;
  return {
    on: jest.fn((event, cb) => {
      if (event === 'connection') connectionCb = cb;
    }),
    _simulateConnection: (socket) => connectionCb(socket),
  };
}

describe('SocketHandler', () => {
  let joinLobbyUseCase;
  let assignTeamUseCase;
  let markReadyUseCase;
  let startBattleUseCase;
  let processAttackUseCase;
  let realtimePort;
  let handler;

  beforeEach(() => {
    joinLobbyUseCase = { execute: jest.fn() };
    assignTeamUseCase = { execute: jest.fn() };
    markReadyUseCase = { execute: jest.fn() };
    startBattleUseCase = { execute: jest.fn() };
    processAttackUseCase = { execute: jest.fn() };
    realtimePort = {
      notifyLobbyStatus: jest.fn(),
      notifyBattleStart: jest.fn(),
      notifyTurnResult: jest.fn(),
      notifyBattleEnd: jest.fn(),
    };
    handler = new SocketHandler(
      joinLobbyUseCase,
      assignTeamUseCase,
      markReadyUseCase,
      startBattleUseCase,
      processAttackUseCase,
      realtimePort
    );
  });

  describe('attach', () => {
    it('registers connection and event listeners on io', () => {
      const mockIo = createMockIo();
      handler.attach(mockIo);

      expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
      mockIo._simulateConnection(createMockSocket());
      const socket = createMockSocket();
      mockIo._simulateConnection(socket);
      expect(socket.on).toHaveBeenCalledWith('join_lobby', expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith('assign_pokemon', expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith('attack', expect.any(Function));
    });
  });

  describe('handleJoinLobby', () => {
    it('calls use case, joins socket to room, notifies lobby status, and acks with result', async () => {
      const mockIo = createMockIo();
      const socket = createMockSocket();
      handler.attach(mockIo);
      mockIo._simulateConnection(socket);

      const result = {
        player: { id: 'p1', nickname: 'Ash', lobbyId: 'l1' },
        lobby: { id: 'l1', status: 'waiting', playerIds: ['p1'], readyPlayerIds: [] },
      };
      joinLobbyUseCase.execute.mockResolvedValue(result);

      const ack = jest.fn();
      socket._trigger('join_lobby', { nickname: 'Ash' }, ack);

      await new Promise((r) => setTimeout(r, 0));

      expect(joinLobbyUseCase.execute).toHaveBeenCalledWith({ nickname: 'Ash' });
      expect(socket.join).toHaveBeenCalledWith('lobby:l1');
      expect(socket.data.lobbyId).toBe('l1');
      expect(socket.data.playerId).toBe('p1');
      expect(realtimePort.notifyLobbyStatus).toHaveBeenCalledWith('l1', { lobby: result.lobby, player: result.player });
      expect(ack).toHaveBeenCalledWith({ player: result.player, lobby: result.lobby });
    });

    it('emits error and acks with error when use case throws', async () => {
      const mockIo = createMockIo();
      const socket = createMockSocket();
      handler.attach(mockIo);
      mockIo._simulateConnection(socket);

      joinLobbyUseCase.execute.mockRejectedValue(new ValidationError('nickname is required'));

      const ack = jest.fn();
      socket._trigger('join_lobby', { nickname: '' }, ack);

      await new Promise((r) => setTimeout(r, 0));

      expect(socket.emit).toHaveBeenCalledWith('error', { code: 'ValidationError', message: 'nickname is required' });
      expect(ack).toHaveBeenCalledWith({ error: { code: 'ValidationError', message: 'nickname is required' } });
      expect(realtimePort.notifyLobbyStatus).not.toHaveBeenCalled();
    });

    it('works without ack callback', async () => {
      const mockIo = createMockIo();
      const socket = createMockSocket();
      handler.attach(mockIo);
      mockIo._simulateConnection(socket);

      joinLobbyUseCase.execute.mockResolvedValue({
        player: { id: 'p1', lobbyId: 'l1' },
        lobby: { id: 'l1', status: 'waiting' },
      });

      socket._trigger('join_lobby', { nickname: 'Ash' });

      await new Promise((r) => setTimeout(r, 0));

      expect(socket.join).toHaveBeenCalled();
      expect(realtimePort.notifyLobbyStatus).toHaveBeenCalled();
    });
  });

  describe('handleAssignPokemon', () => {
    it('calls use case, joins room if not in it, notifies lobby status, acks with team', async () => {
      const mockIo = createMockIo();
      const socket = createMockSocket();
      socket.data.lobbyId = 'l1';
      socket.data.playerId = 'p1';
      socket.rooms.add('other');
      handler.attach(mockIo);
      mockIo._simulateConnection(socket);

      const team = { id: 't1', lobbyId: 'l1', playerId: 'p1', pokemonIds: [1, 2, 3] };
      const lobby = { id: 'l1', status: 'waiting', playerIds: ['p1', 'p2'] };
      assignTeamUseCase.execute.mockResolvedValue({ team, lobby });

      const ack = jest.fn();
      socket._trigger('assign_pokemon', { lobbyId: 'l1' }, ack);

      await new Promise((r) => setTimeout(r, 0));

      expect(assignTeamUseCase.execute).toHaveBeenCalledWith({ lobbyId: 'l1', playerId: 'p1' });
      expect(socket.join).toHaveBeenCalledWith('lobby:l1');
      expect(realtimePort.notifyLobbyStatus).toHaveBeenCalledWith('l1', { lobby });
      expect(ack).toHaveBeenCalledWith(team);
    });

    it('does not join if socket already in room', async () => {
      const mockIo = createMockIo();
      const socket = createMockSocket();
      socket.data.lobbyId = 'l1';
      socket.data.playerId = 'p1';
      socket.rooms.add('lobby:l1');
      handler.attach(mockIo);
      mockIo._simulateConnection(socket);

      const team = { id: 't1', lobbyId: 'l1', playerId: 'p1', pokemonIds: [1, 2, 3] };
      assignTeamUseCase.execute.mockResolvedValue({ team, lobby: { id: 'l1' } });

      socket._trigger('assign_pokemon', { lobbyId: 'l1' }, jest.fn());

      await new Promise((r) => setTimeout(r, 0));

      expect(socket.join).not.toHaveBeenCalled();
      expect(realtimePort.notifyLobbyStatus).toHaveBeenCalled();
    });

    it('emits error when use case throws NotFoundError', async () => {
      const mockIo = createMockIo();
      const socket = createMockSocket();
      socket.data.lobbyId = 'l1';
      socket.data.playerId = 'p1';
      handler.attach(mockIo);
      mockIo._simulateConnection(socket);

      assignTeamUseCase.execute.mockRejectedValue(new NotFoundError('Lobby not found'));

      const ack = jest.fn();
      socket._trigger('assign_pokemon', { lobbyId: 'l1' }, ack);

      await new Promise((r) => setTimeout(r, 0));

      expect(socket.emit).toHaveBeenCalledWith('error', { code: 'NotFoundError', message: 'Lobby not found' });
      expect(ack).toHaveBeenCalledWith({ error: { code: 'NotFoundError', message: 'Lobby not found' } });
    });

    it('emits error when socket has no player context', async () => {
      const mockIo = createMockIo();
      const socket = createMockSocket();
      handler.attach(mockIo);
      mockIo._simulateConnection(socket);

      const ack = jest.fn();
      socket._trigger('assign_pokemon', {}, ack);

      await new Promise((r) => setTimeout(r, 0));

      expect(socket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'ValidationError' }));
      expect(ack).toHaveBeenCalledWith({ error: expect.objectContaining({ code: 'ValidationError' }) });
    });
  });

  describe('handleReady', () => {
    it('calls use case, notifies lobby status, acks with lobby', async () => {
      const mockIo = createMockIo();
      const socket = createMockSocket();
      socket.data.lobbyId = 'l1';
      socket.data.playerId = 'p1';
      handler.attach(mockIo);
      mockIo._simulateConnection(socket);

      const lobby = { id: 'l1', status: 'waiting', playerIds: ['p1', 'p2'], readyPlayerIds: ['p1'] };
      markReadyUseCase.execute.mockResolvedValue(lobby);

      const ack = jest.fn();
      socket._trigger('ready', { lobbyId: 'l1' }, ack);

      await new Promise((r) => setTimeout(r, 0));

      expect(markReadyUseCase.execute).toHaveBeenCalledWith({ lobbyId: 'l1', playerId: 'p1' });
      expect(realtimePort.notifyLobbyStatus).toHaveBeenCalledWith('l1', { lobby });
      expect(ack).toHaveBeenCalledWith(lobby);
      expect(startBattleUseCase.execute).not.toHaveBeenCalled();
    });

    it('calls startBattleUseCase when lobby becomes ready', async () => {
      const mockIo = createMockIo();
      const socket = createMockSocket();
      socket.data.lobbyId = 'l1';
      socket.data.playerId = 'p2';
      handler.attach(mockIo);
      mockIo._simulateConnection(socket);

      const lobby = { id: 'l1', status: 'ready', playerIds: ['p1', 'p2'], readyPlayerIds: ['p1', 'p2'] };
      markReadyUseCase.execute.mockResolvedValue(lobby);
      startBattleUseCase.execute.mockResolvedValue({ battle: {}, pokemonStates: [] });

      const ack = jest.fn();
      socket._trigger('ready', { lobbyId: 'l1' }, ack);

      await new Promise((r) => setTimeout(r, 0));

      expect(markReadyUseCase.execute).toHaveBeenCalledWith({ lobbyId: 'l1', playerId: 'p2' });
      expect(realtimePort.notifyLobbyStatus).toHaveBeenCalledWith('l1', { lobby });
      expect(startBattleUseCase.execute).toHaveBeenCalledWith({ lobbyId: 'l1' });
      expect(ack).toHaveBeenCalledWith(lobby);
    });

    it('emits error when use case throws ConflictError', async () => {
      const mockIo = createMockIo();
      const socket = createMockSocket();
      socket.data.lobbyId = 'l1';
      socket.data.playerId = 'p1';
      handler.attach(mockIo);
      mockIo._simulateConnection(socket);

      markReadyUseCase.execute.mockRejectedValue(new ConflictError('Lobby is full'));

      const ack = jest.fn();
      socket._trigger('ready', { lobbyId: 'l1' }, ack);

      await new Promise((r) => setTimeout(r, 0));

      expect(socket.emit).toHaveBeenCalledWith('error', { code: 'ConflictError', message: 'Lobby is full' });
      expect(ack).toHaveBeenCalledWith({ error: { code: 'ConflictError', message: 'Lobby is full' } });
    });
  });

  describe('handleAttack', () => {
    it('calls processAttackUseCase with only lobbyId and attackerPlayerId, acks with turn result', async () => {
      const mockIo = createMockIo();
      const socket = createMockSocket();
      socket.data.lobbyId = 'l1';
      socket.data.playerId = 'p1';
      handler.attach(mockIo);
      mockIo._simulateConnection(socket);

      const turnResult = {
        battleId: 'b1',
        lobbyId: 'l1',
        attacker: { playerId: 'p1', pokemonId: 1 },
        defender: { playerId: 'p2', pokemonId: 4, damage: 10, previousHp: 30, currentHp: 20, defeated: false },
        nextActivePokemon: { playerId: 'p2', pokemonId: null },
        battleFinished: false,
      };
      processAttackUseCase.execute.mockResolvedValue(turnResult);

      const ack = jest.fn();
      socket._trigger('attack', { lobbyId: 'l1' }, ack);

      await new Promise((r) => setTimeout(r, 0));

      expect(processAttackUseCase.execute).toHaveBeenCalledWith({
        lobbyId: 'l1',
        attackerPlayerId: 'p1',
      });
      expect(ack).toHaveBeenCalledWith(turnResult);
      expect(socket.emit).not.toHaveBeenCalledWith('error', expect.anything());
    });

    it('emits error and acks with error when processAttackUseCase throws', async () => {
      const mockIo = createMockIo();
      const socket = createMockSocket();
      socket.data.lobbyId = 'l1';
      socket.data.playerId = 'p1';
      handler.attach(mockIo);
      mockIo._simulateConnection(socket);

      processAttackUseCase.execute.mockRejectedValue(new ConflictError('Not this player\'s turn'));

      const ack = jest.fn();
      socket._trigger('attack', { lobbyId: 'l1' }, ack);

      await new Promise((r) => setTimeout(r, 0));

      expect(socket.emit).toHaveBeenCalledWith('error', { code: 'ConflictError', message: 'Not this player\'s turn' });
      expect(ack).toHaveBeenCalledWith({ error: { code: 'ConflictError', message: 'Not this player\'s turn' } });
    });

    it('emits ValidationError when socket is not in lobby', async () => {
      const mockIo = createMockIo();
      const socket = createMockSocket();
      socket.data.lobbyId = 'other';
      socket.data.playerId = 'p1';
      handler.attach(mockIo);
      mockIo._simulateConnection(socket);

      const ack = jest.fn();
      socket._trigger('attack', { lobbyId: 'l1' }, ack);

      await new Promise((r) => setTimeout(r, 0));

      expect(processAttackUseCase.execute).not.toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith('error', { code: 'ValidationError', message: 'Socket is not in this lobby' });
    });
  });
});
