import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { PersistenceController } from '../persistence.controller.js';
import { ValidationError } from '../../errors/Validation.error.js';
import { NotFoundError } from '../../errors/NotFound.error.js';
import { ConflictError } from '../../errors/Conflict.error.js';

describe('PersistenceController', () => {
  let app;
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
    const controller = new PersistenceController(
      mockLobbyRepository,
      mockPlayerRepository
    );
    app = express();
    app.use(express.json());
    app.use(controller.getRouter());
  });

  describe('POST /lobby', () => {
    it('returns 201 and saved lobby with default status and playerIds', async () => {
      const saved = { id: 'l1', status: 'waiting', playerIds: [] };
      mockLobbyRepository.save.mockResolvedValue(saved);

      const response = await request(app)
        .post('/lobby')
        .send({})
        .set('Accept', 'application/json');

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ id: 'l1', status: 'waiting', playerIds: [] });
      expect(mockLobbyRepository.save).toHaveBeenCalledWith({
        status: 'waiting',
        playerIds: [],
      });
    });

    it('returns 201 and saved lobby with provided body', async () => {
      const body = { status: 'ready', playerIds: ['p1', 'p2'] };
      const saved = { id: 'l2', ...body };
      mockLobbyRepository.save.mockResolvedValue(saved);

      const response = await request(app)
        .post('/lobby')
        .send(body)
        .set('Accept', 'application/json');

      expect(response.status).toBe(201);
      expect(response.body).toEqual(saved);
      expect(mockLobbyRepository.save).toHaveBeenCalledWith(body);
    });

    it('returns 400 when status is invalid', async () => {
      const response = await request(app)
        .post('/lobby')
        .send({ status: 'invalid', playerIds: [] })
        .set('Accept', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/status must be one of/);
      expect(mockLobbyRepository.save).not.toHaveBeenCalled();
    });

    it('returns 400 when playerIds is not an array', async () => {
      const response = await request(app)
        .post('/lobby')
        .send({ status: 'waiting', playerIds: 'not-array' })
        .set('Accept', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('playerIds must be an array');
      expect(mockLobbyRepository.save).not.toHaveBeenCalled();
    });

    it('returns 500 when repository throws', async () => {
      mockLobbyRepository.save.mockRejectedValue(new Error('DB error'));

      const response = await request(app)
        .post('/lobby')
        .send({ status: 'waiting', playerIds: [] });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('DB error');
    });
  });

  describe('GET /lobby/active', () => {
    it('returns 200 and active lobby', async () => {
      const lobby = { id: 'l1', status: 'waiting', playerIds: [] };
      mockLobbyRepository.findActive.mockResolvedValue(lobby);

      const response = await request(app)
        .get('/lobby/active')
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(lobby);
      expect(mockLobbyRepository.findActive).toHaveBeenCalledTimes(1);
    });

    it('returns 404 when no active lobby', async () => {
      mockLobbyRepository.findActive.mockResolvedValue(null);

      const response = await request(app)
        .get('/lobby/active')
        .set('Accept', 'application/json');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('No active lobby');
    });

    it('returns 500 when repository throws', async () => {
      mockLobbyRepository.findActive.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/lobby/active');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('DB error');
    });
  });

  describe('POST /player', () => {
    it('returns 201 and saved player', async () => {
      const saved = { id: 'p1', nickname: 'Ash', lobbyId: undefined };
      mockPlayerRepository.save.mockResolvedValue(saved);

      const response = await request(app)
        .post('/player')
        .send({ nickname: 'Ash' })
        .set('Accept', 'application/json');

      expect(response.status).toBe(201);
      expect(response.body).toEqual(saved);
      expect(mockPlayerRepository.save).toHaveBeenCalledWith({ nickname: 'Ash' });
    });

    it('trims nickname and returns 201', async () => {
      const saved = { id: 'p2', nickname: 'Misty' };
      mockPlayerRepository.save.mockResolvedValue(saved);

      const response = await request(app)
        .post('/player')
        .send({ nickname: '  Misty  ' })
        .set('Accept', 'application/json');

      expect(response.status).toBe(201);
      expect(mockPlayerRepository.save).toHaveBeenCalledWith({ nickname: 'Misty' });
    });

    it('returns 400 when nickname is missing', async () => {
      const response = await request(app)
        .post('/player')
        .send({})
        .set('Accept', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/nickname is required/);
      expect(mockPlayerRepository.save).not.toHaveBeenCalled();
    });

    it('returns 400 when nickname is not a string', async () => {
      const response = await request(app)
        .post('/player')
        .send({ nickname: 123 })
        .set('Accept', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/nickname is required/);
      expect(mockPlayerRepository.save).not.toHaveBeenCalled();
    });

    it('returns 400 when nickname is empty after trim', async () => {
      const response = await request(app)
        .post('/player')
        .send({ nickname: '   ' })
        .set('Accept', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('nickname cannot be empty');
      expect(mockPlayerRepository.save).not.toHaveBeenCalled();
    });

    it('returns 400 when controller throws ValidationError from repo', async () => {
      mockPlayerRepository.save.mockRejectedValue(
        new ValidationError('nickname too long')
      );

      const response = await request(app)
        .post('/player')
        .send({ nickname: 'Ash' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('nickname too long');
    });

    it('returns 409 when controller receives ConflictError from repo', async () => {
      mockPlayerRepository.save.mockRejectedValue(
        new ConflictError('Duplicate nickname')
      );

      const response = await request(app)
        .post('/player')
        .send({ nickname: 'Ash' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Duplicate nickname');
    });
  });
});
