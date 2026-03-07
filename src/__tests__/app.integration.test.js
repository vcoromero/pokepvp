import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../app.js';
import { ThirdPartyApiFailedError } from '../infrastructure/errors/ThirdPartyApiFailed.error.js';
import { InvalidConfigError } from '../infrastructure/errors/InvalidConfig.error.js';
import { ValidationError } from '../infrastructure/errors/Validation.error.js';
import { NotFoundError } from '../infrastructure/errors/NotFound.error.js';
import { ConflictError } from '../infrastructure/errors/Conflict.error.js';

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

  describe('persistence routes (with mock repositories)', () => {
    let appWithRepos;
    let mockLobbyRepository;
    let mockPlayerRepository;

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
      appWithRepos = createApp({
        catalogPort: mockCatalogPort,
        repositories: {
          lobbyRepository: mockLobbyRepository,
          playerRepository: mockPlayerRepository,
          teamRepository: {},
          battleRepository: {},
          pokemonStateRepository: {},
        },
      });
    });

    it('POST /player returns 201 and saved player', async () => {
      const saved = { id: 'p1', nickname: 'Ash' };
      mockPlayerRepository.save.mockResolvedValue(saved);

      const response = await request(appWithRepos)
        .post('/player')
        .send({ nickname: 'Ash' })
        .set('Accept', 'application/json');

      expect(response.status).toBe(201);
      expect(response.body).toEqual(saved);
    });

    it('POST /lobby returns 201 and saved lobby', async () => {
      const saved = { id: 'l1', status: 'waiting', playerIds: [] };
      mockLobbyRepository.save.mockResolvedValue(saved);

      const response = await request(appWithRepos)
        .post('/lobby')
        .send({ status: 'waiting', playerIds: [] })
        .set('Accept', 'application/json');

      expect(response.status).toBe(201);
      expect(response.body).toEqual(saved);
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

    it('error middleware returns 400 for ValidationError', async () => {
      mockPlayerRepository.save.mockRejectedValue(
        new ValidationError('Invalid input', 400)
      );

      const response = await request(appWithRepos)
        .post('/player')
        .send({ nickname: 'x' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid input');
    });

    it('error middleware returns 404 for NotFoundError', async () => {
      mockLobbyRepository.findActive.mockRejectedValue(
        new NotFoundError('Not found', 404)
      );

      const response = await request(appWithRepos).get('/lobby/active');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not found');
    });

    it('error middleware returns 409 for ConflictError', async () => {
      mockPlayerRepository.save.mockRejectedValue(
        new ConflictError('Duplicate', 409)
      );

      const response = await request(appWithRepos)
        .post('/player')
        .send({ nickname: 'Ash' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Duplicate');
    });
  });
});
