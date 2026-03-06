import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../app.js';
import { ThirdPartyApiFailedError } from '../infrastructure/errors/ThirdPartyApiFailed.error.js';
import { InvalidConfigError } from '../infrastructure/errors/InvalidConfig.error.js';

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
});
