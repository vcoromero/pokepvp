import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../app.js';
import { ThirdPartyApiFailedError } from '../infrastructure/errors/ThirdPartyApiFailed.error.js';
import { InvalidConfigError } from '../infrastructure/errors/InvalidConfig.error.js';
import { NotFoundError } from '../application/errors/NotFound.error.js';

describe('App integration', () => {
  let app;
  let mockCatalogPort;

  beforeEach(() => {
    mockCatalogPort = {
      getList: jest.fn().mockResolvedValue([{ id: 1, name: 'bulbasaur' }]),
      getById: jest.fn().mockResolvedValue({ id: 7, name: 'squirtle' }),
    };
    app = createApp({ catalogPort: mockCatalogPort });
  });

  describe('GET /health', () => {
    it('responds with 200 and status ok', async () => {
      const response = await request(app)
        .get('/health')
        .set('Accept', 'application/json');

      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /catalog/list', () => {
    it('responds with json list from catalog port', async () => {
      const list = [{ id: 1, name: 'bulbasaur' }, { id: 2, name: 'ivysaur' }];
      mockCatalogPort.getList.mockResolvedValue(list);

      const response = await request(app)
        .get('/catalog/list')
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(list);
      expect(mockCatalogPort.getList).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /catalog/list/:id', () => {
    it('responds with pokemon by id', async () => {
      const pokemon = { id: 7, name: 'squirtle' };
      mockCatalogPort.getById.mockResolvedValue(pokemon);

      const response = await request(app)
        .get('/catalog/list/7')
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(pokemon);
      expect(mockCatalogPort.getById).toHaveBeenCalledWith('7');
    });
  });

  describe('error middleware', () => {
    it('returns 503 when catalog throws ThirdPartyApiFailedError with 5xx', async () => {
      mockCatalogPort.getList.mockRejectedValue(
        new ThirdPartyApiFailedError('PokeAPI down', 502)
      );

      const response = await request(app).get('/catalog/list');

      expect(response.status).toBe(503);
      expect(response.body.error).toBe('PokeAPI down');
    });

    it('returns 500 when catalog throws InvalidConfigError', async () => {
      mockCatalogPort.getList.mockRejectedValue(
        new InvalidConfigError('POKEAPI_BASE_URL not set')
      );

      const response = await request(app).get('/catalog/list');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('POKEAPI_BASE_URL not set');
    });
  });

  describe('lobby routes (with mock repositories)', () => {
    let appWithRepos;
    let mockLobbyRepository;
    let mockPlayerRepository;
    let mockTeamRepository;

    beforeEach(() => {
      mockLobbyRepository = {
        save: jest.fn(),
        findById: jest.fn(),
        findActive: jest.fn(),
      };
      mockPlayerRepository = {
        save: jest.fn(),
        findById: jest.fn(),
        findByLobbyId: jest.fn(),
      };
      mockTeamRepository = {
        save: jest.fn(),
        findByLobby: jest.fn(),
        findByLobbyAndPlayer: jest.fn(),
      };
      appWithRepos = createApp({
        catalogPort: mockCatalogPort,
        repositories: {
          lobbyRepository: mockLobbyRepository,
          playerRepository: mockPlayerRepository,
          teamRepository: mockTeamRepository,
          battleRepository: {},
          pokemonStateRepository: {},
        },
      });
    });

    it('GET /lobby/active returns 200 when lobby exists', async () => {
      const lobby = { id: 'l1', status: 'waiting', playerIds: [] };
      mockLobbyRepository.findActive.mockResolvedValue(lobby);

      const response = await request(appWithRepos)
        .get('/lobby/active')
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(lobby);
    });

    it('GET /lobby/active returns 404 when no active lobby', async () => {
      mockLobbyRepository.findActive.mockResolvedValue(null);

      const response = await request(appWithRepos).get('/lobby/active');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('No active lobby');
    });

    it('error middleware returns 404 for NotFoundError', async () => {
      mockLobbyRepository.findActive.mockRejectedValue(
        new NotFoundError('Not found', 404)
      );

      const response = await request(appWithRepos).get('/lobby/active');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not found');
    });

    it('POST /lobby/join returns 201 and joins player', async () => {
      mockLobbyRepository.findActive.mockResolvedValue(null);
      mockLobbyRepository.save
        .mockResolvedValueOnce({ id: 'l1', status: 'waiting', playerIds: [], readyPlayerIds: [] })
        .mockResolvedValueOnce({ id: 'l1', status: 'waiting', playerIds: ['p1'], readyPlayerIds: [] });
      mockPlayerRepository.save.mockResolvedValue({ id: 'p1', nickname: 'Ash', lobbyId: 'l1' });

      const response = await request(appWithRepos)
        .post('/lobby/join')
        .send({ nickname: 'Ash' });

      expect(response.status).toBe(201);
      expect(response.body.player).toEqual({ id: 'p1', nickname: 'Ash', lobbyId: 'l1' });
      expect(response.body.lobby.playerIds).toEqual(['p1']);
    });

    it('POST /lobby/:id/assign-team returns 200 with team', async () => {
      mockLobbyRepository.findById.mockResolvedValue({
        id: 'l1',
        status: 'waiting',
        playerIds: ['p1', 'p2'],
        readyPlayerIds: [],
      });
      mockTeamRepository.findByLobby.mockResolvedValue([{ playerId: 'p1', pokemonIds: [1, 2, 3] }]);
      mockCatalogPort.getList.mockResolvedValue([
        { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 },
      ]);
      mockTeamRepository.save.mockResolvedValue({
        id: 't2',
        lobbyId: 'l1',
        playerId: 'p2',
        pokemonIds: [4, 5, 6],
      });

      const response = await request(appWithRepos)
        .post('/lobby/l1/assign-team')
        .send({ playerId: 'p2' });

      expect(response.status).toBe(200);
      expect(response.body.pokemonIds).toEqual([4, 5, 6]);
    });

    it('POST /lobby/:id/ready returns 200 and updates lobby status to ready', async () => {
      mockLobbyRepository.findById.mockResolvedValue({
        id: 'l1',
        status: 'waiting',
        playerIds: ['p1', 'p2'],
        readyPlayerIds: ['p1'],
      });
      mockTeamRepository.findByLobbyAndPlayer.mockResolvedValue({ id: 't2' });
      mockLobbyRepository.save
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

      const response = await request(appWithRepos)
        .post('/lobby/l1/ready')
        .send({ playerId: 'p2' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ready');
    });

    it('returns 404 for deprecated Stage 3 routes', async () => {
      const playerResponse = await request(appWithRepos)
        .post('/player')
        .send({ nickname: 'Ash' });
      const lobbyResponse = await request(appWithRepos)
        .post('/lobby')
        .send({ status: 'waiting', playerIds: [] });

      expect(playerResponse.status).toBe(404);
      expect(lobbyResponse.status).toBe(404);
    });
  });
});
