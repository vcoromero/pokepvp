import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { CatalogController } from '../catalog.controller.js';
import { ThirdPartyApiFailedError } from '../../errors/ThirdPartyApiFailed.error.js';
import { InvalidConfigError } from '../../errors/InvalidConfig.error.js';

describe('CatalogController', () => {
  let app;
  let mockGetPokemonListUseCase;
  let mockGetPokemonByIdUseCase;

  beforeEach(() => {
    mockGetPokemonListUseCase = { execute: jest.fn() };
    mockGetPokemonByIdUseCase = { execute: jest.fn() };
    const controller = new CatalogController(
      mockGetPokemonListUseCase,
      mockGetPokemonByIdUseCase
    );
    app = express();
    app.use(express.json());
    app.use('/catalog', controller.getRouter());
  });

  describe('GET /catalog/list', () => {
    it('returns list from use case and 200', async () => {
      const list = [{ id: 1, name: 'bulbasaur' }];
      mockGetPokemonListUseCase.execute.mockResolvedValue(list);

      const response = await request(app)
        .get('/catalog/list')
        .set('Accept', 'application/json');

      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.status).toBe(200);
      expect(response.body).toEqual(list);
      expect(mockGetPokemonListUseCase.execute).toHaveBeenCalledTimes(1);
    });

    it('returns 500 and error message when use case throws', async () => {
      mockGetPokemonListUseCase.execute.mockRejectedValue(new Error('Broken'));

      const response = await request(app).get('/catalog/list');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Broken');
    });

    it('returns 404 when use case throws ThirdPartyApiFailedError with 404 status', async () => {
      mockGetPokemonListUseCase.execute.mockRejectedValue(
        new ThirdPartyApiFailedError('Not found', 404)
      );

      const response = await request(app).get('/catalog/list');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not found');
    });

    it('returns 503 when use case throws ThirdPartyApiFailedError with 5xx status', async () => {
      mockGetPokemonListUseCase.execute.mockRejectedValue(
        new ThirdPartyApiFailedError('Gateway error', 502)
      );

      const response = await request(app).get('/catalog/list');

      expect(response.status).toBe(503);
      expect(response.body.error).toBe('Gateway error');
    });

    it('returns 400 when use case throws ThirdPartyApiFailedError with status 400', async () => {
      mockGetPokemonListUseCase.execute.mockRejectedValue(
        new ThirdPartyApiFailedError('Bad request', 400)
      );

      const response = await request(app).get('/catalog/list');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad request');
    });

    it('returns 500 when use case throws InvalidConfigError', async () => {
      mockGetPokemonListUseCase.execute.mockRejectedValue(
        new InvalidConfigError('Missing POKEAPI_BASE_URL')
      );

      const response = await request(app).get('/catalog/list');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Missing POKEAPI_BASE_URL');
    });
  });

  describe('GET /catalog/list/:id', () => {
    it('returns pokemon by id and 200', async () => {
      const pokemon = { id: 7, name: 'squirtle' };
      mockGetPokemonByIdUseCase.execute.mockResolvedValue(pokemon);

      const response = await request(app)
        .get('/catalog/list/7')
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(pokemon);
      expect(mockGetPokemonByIdUseCase.execute).toHaveBeenCalledWith('7');
    });

    it('returns 500 when use case throws', async () => {
      mockGetPokemonByIdUseCase.execute.mockRejectedValue(new Error('Not found'));

      const response = await request(app).get('/catalog/list/999');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Not found');
    });
  });
});
