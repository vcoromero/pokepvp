import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import http from 'http';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import { createApp } from '../app.js';
import { PokeAPIAdapter } from '../infrastructure/clients/pokeapi.adapter.js';
import { JoinLobbyUseCase } from '../application/use-cases/join-lobby.use-case.js';
import { AssignTeamUseCase } from '../application/use-cases/assign-team.use-case.js';
import { MarkReadyUseCase } from '../application/use-cases/mark-ready.use-case.js';
import { SocketIOAdapter } from '../infrastructure/socket/socketio.adapter.js';
import { SocketHandler } from '../infrastructure/socket/socket.handler.js';

describe('Socket.IO integration', () => {
  let server;
  let mockLobbyRepository;
  let mockPlayerRepository;
  let mockTeamRepository;
  let mockCatalogPort;

  beforeEach(() => {
    mockCatalogPort = {
      getList: jest.fn().mockResolvedValue([
        { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 },
      ]),
      getById: jest.fn().mockResolvedValue({ id: 1, name: 'bulbasaur' }),
    };
    mockLobbyRepository = {
      findActive: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
    };
    mockPlayerRepository = {
      save: jest.fn(),
    };
    mockTeamRepository = {
      save: jest.fn(),
      findByLobby: jest.fn(),
      findByLobbyAndPlayer: jest.fn(),
    };

    const app = createApp({
      catalogPort: mockCatalogPort,
      repositories: {
        lobbyRepository: mockLobbyRepository,
        playerRepository: mockPlayerRepository,
        teamRepository: mockTeamRepository,
        battleRepository: {},
        pokemonStateRepository: {},
      },
    });

    server = http.createServer(app);
    const io = new Server(server, {
      path: '/socket.io',
      cors: { origin: '*' },
    });

    const joinLobbyUseCase = new JoinLobbyUseCase(mockPlayerRepository, mockLobbyRepository);
    const assignTeamUseCase = new AssignTeamUseCase(
      mockCatalogPort,
      mockLobbyRepository,
      mockTeamRepository
    );
    const markReadyUseCase = new MarkReadyUseCase(mockLobbyRepository, mockTeamRepository);
    const realtimePort = new SocketIOAdapter(io);
    const socketHandler = new SocketHandler(
      joinLobbyUseCase,
      assignTeamUseCase,
      markReadyUseCase,
      realtimePort,
      mockLobbyRepository
    );
    socketHandler.attach(io);
  });

  afterEach((done) => {
    if (server && server.listening) {
      server.close(done);
    } else {
      done();
    }
  });

  function listen(port) {
    return new Promise((resolve, reject) => {
      server.listen(port, '127.0.0.1', () => resolve(server.address().port));
      server.on('error', reject);
    });
  }

  function connect(port) {
    return new Promise((resolve, reject) => {
      const socket = ioClient(`http://127.0.0.1:${port}`, {
        path: '/socket.io',
        transports: ['websocket'],
      });
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', reject);
    });
  }

  it('join_lobby creates lobby, joins room, emits lobby_status and acks with player and lobby', async () => {
    mockLobbyRepository.findActive.mockResolvedValue(null);
    mockLobbyRepository.save
      .mockResolvedValueOnce({ id: 'l1', status: 'waiting', playerIds: [], readyPlayerIds: [] })
      .mockResolvedValueOnce({ id: 'l1', status: 'waiting', playerIds: ['p1'], readyPlayerIds: [] });
    mockPlayerRepository.save.mockResolvedValue({ id: 'p1', nickname: 'Ash', lobbyId: 'l1' });

    const port = await listen(0);
    const socket = await connect(port);

    const lobbyStatusReceived = new Promise((resolve) => {
      socket.on('lobby_status', resolve);
    });

    const ackReceived = new Promise((resolve) => {
      socket.emit('join_lobby', { nickname: 'Ash' }, (response) => {
        resolve(response);
      });
    });

    const [lobbyStatusPayload, ackResponse] = await Promise.all([lobbyStatusReceived, ackReceived]);

    expect(ackResponse).toEqual({
      player: { id: 'p1', nickname: 'Ash', lobbyId: 'l1' },
      lobby: { id: 'l1', status: 'waiting', playerIds: ['p1'], readyPlayerIds: [] },
    });
    expect(lobbyStatusPayload).toEqual({
      lobby: { id: 'l1', status: 'waiting', playerIds: ['p1'], readyPlayerIds: [] },
      player: { id: 'p1', nickname: 'Ash', lobbyId: 'l1' },
    });

    socket.disconnect();
  });

  it('assign_pokemon and ready flow emits lobby_status to connected clients', async () => {
    mockLobbyRepository.findActive
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: 'l1', status: 'waiting', playerIds: ['p1'], readyPlayerIds: [] });
    mockLobbyRepository.save
      .mockResolvedValueOnce({ id: 'l1', status: 'waiting', playerIds: [], readyPlayerIds: [] })
      .mockResolvedValueOnce({ id: 'l1', status: 'waiting', playerIds: ['p1'], readyPlayerIds: [] })
      .mockResolvedValue({ id: 'l1', status: 'waiting', playerIds: ['p1', 'p2'], readyPlayerIds: [] });
    mockPlayerRepository.save
      .mockResolvedValueOnce({ id: 'p1', nickname: 'P1', lobbyId: 'l1' })
      .mockResolvedValueOnce({ id: 'p2', nickname: 'P2', lobbyId: 'l1' });

    mockLobbyRepository.findById.mockResolvedValue({
      id: 'l1',
      status: 'waiting',
      playerIds: ['p1', 'p2'],
      readyPlayerIds: [],
    });
    mockTeamRepository.findByLobby.mockResolvedValue([]);
    mockTeamRepository.save
      .mockResolvedValueOnce({ id: 't1', lobbyId: 'l1', playerId: 'p1', pokemonIds: [1, 2, 3] })
      .mockResolvedValueOnce({ id: 't2', lobbyId: 'l1', playerId: 'p2', pokemonIds: [4, 5, 6] });
    mockTeamRepository.findByLobbyAndPlayer.mockResolvedValue({ id: 't1' });
    mockLobbyRepository.save
      .mockResolvedValueOnce({
        id: 'l1',
        status: 'waiting',
        playerIds: ['p1', 'p2'],
        readyPlayerIds: ['p1'],
      })
      .mockResolvedValueOnce({
        id: 'l1',
        status: 'ready',
        playerIds: ['p1', 'p2'],
        readyPlayerIds: ['p1', 'p2'],
      });

    const port = await listen(0);
    const socket1 = await connect(port);
    const socket2 = await connect(port);

    const p1JoinAck = new Promise((resolve) => {
      socket1.emit('join_lobby', { nickname: 'P1' }, resolve);
    });
    await p1JoinAck;

    const p2JoinAck = new Promise((resolve) => {
      socket2.emit('join_lobby', { nickname: 'P2' }, resolve);
    });
    await p2JoinAck;

    const lobbyStatuses = [];
    socket1.on('lobby_status', (payload) => lobbyStatuses.push(payload));
    socket2.on('lobby_status', (payload) => lobbyStatuses.push(payload));

    const assignAck = new Promise((resolve) => {
      socket1.emit('assign_pokemon', { lobbyId: 'l1', playerId: 'p1' }, resolve);
    });
    await assignAck;

    expect(lobbyStatuses.length).toBeGreaterThanOrEqual(1);
    expect(lobbyStatuses.some((p) => p.lobby?.id === 'l1')).toBe(true);

    const readyAck = new Promise((resolve) => {
      socket1.emit('ready', { lobbyId: 'l1', playerId: 'p1' }, resolve);
    });
    await readyAck;

    socket1.disconnect();
    socket2.disconnect();
  });

  it('attack emits error event with attack_not_available', async () => {
    mockLobbyRepository.findActive.mockResolvedValue(null);
    mockLobbyRepository.save
      .mockResolvedValueOnce({ id: 'l1', status: 'waiting', playerIds: [], readyPlayerIds: [] })
      .mockResolvedValue({ id: 'l1', status: 'waiting', playerIds: ['p1'], readyPlayerIds: [] });
    mockPlayerRepository.save.mockResolvedValue({ id: 'p1', nickname: 'Ash', lobbyId: 'l1' });

    const port = await listen(0);
    const socket = await connect(port);

    await new Promise((resolve) => {
      socket.emit('join_lobby', { nickname: 'Ash' }, resolve);
    });

    const errorReceived = new Promise((resolve) => {
      socket.on('error', resolve);
    });

    const ackReceived = new Promise((resolve) => {
      socket.emit('attack', { lobbyId: 'l1', playerId: 'p1' }, resolve);
    });

    const [errorPayload, ackResponse] = await Promise.all([errorReceived, ackReceived]);

    expect(errorPayload).toEqual({
      code: 'attack_not_available',
      message: 'Attack not implemented yet (Stage 6)',
    });
    expect(ackResponse).toEqual({
      error: { code: 'attack_not_available', message: 'Attack not implemented yet (Stage 6)' },
    });

    socket.disconnect();
  });

  it('join_lobby with invalid nickname emits error', async () => {
    mockLobbyRepository.findActive.mockResolvedValue(null);

    const port = await listen(0);
    const socket = await connect(port);

    const errorReceived = new Promise((resolve) => {
      socket.on('error', resolve);
    });

    const ackReceived = new Promise((resolve) => {
      socket.emit('join_lobby', { nickname: '   ' }, resolve);
    });

    const [errorPayload, ackResponse] = await Promise.all([errorReceived, ackReceived]);

    expect(errorPayload.code).toBe('ValidationError');
    expect(ackResponse.error).toBeDefined();
    expect(ackResponse.error.code).toBe('ValidationError');

    socket.disconnect();
  });
});
