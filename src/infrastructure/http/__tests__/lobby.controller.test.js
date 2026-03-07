import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { LobbyController } from '../lobby.controller.js';
import { ValidationError } from '../../../application/errors/Validation.error.js';
import { NotFoundError } from '../../../application/errors/NotFound.error.js';
import { ConflictError } from '../../../application/errors/Conflict.error.js';

describe('LobbyController', () => {
  let app;
  let joinLobbyUseCase;
  let assignTeamUseCase;
  let markReadyUseCase;
  let lobbyRepository;

  beforeEach(() => {
    joinLobbyUseCase = { execute: jest.fn() };
    assignTeamUseCase = { execute: jest.fn() };
    markReadyUseCase = { execute: jest.fn() };
    lobbyRepository = {
      findActive: jest.fn(),
      findById: jest.fn(),
    };

    const controller = new LobbyController(
      joinLobbyUseCase,
      assignTeamUseCase,
      markReadyUseCase,
      lobbyRepository
    );
    app = express();
    app.use(express.json());
    app.use('/lobby', controller.getRouter());
  });

  it('POST /lobby/join returns 201 with player and lobby', async () => {
    joinLobbyUseCase.execute.mockResolvedValue({
      player: { id: 'p1', nickname: 'Ash', lobbyId: 'l1' },
      lobby: { id: 'l1', status: 'waiting', playerIds: ['p1'], readyPlayerIds: [] },
    });

    const response = await request(app).post('/lobby/join').send({ nickname: 'Ash' });

    expect(response.status).toBe(201);
    expect(joinLobbyUseCase.execute).toHaveBeenCalledWith({ nickname: 'Ash' });
    expect(response.body.lobby.id).toBe('l1');
  });

  it('POST /lobby/:lobbyId/assign-team returns 200 with team', async () => {
    assignTeamUseCase.execute.mockResolvedValue({
      id: 't1',
      lobbyId: 'l1',
      playerId: 'p1',
      pokemonIds: [1, 2, 3],
    });

    const response = await request(app)
      .post('/lobby/l1/assign-team')
      .send({ playerId: 'p1' });

    expect(response.status).toBe(200);
    expect(assignTeamUseCase.execute).toHaveBeenCalledWith({ lobbyId: 'l1', playerId: 'p1' });
    expect(response.body.pokemonIds).toEqual([1, 2, 3]);
  });

  it('POST /lobby/:lobbyId/ready returns 200 with updated lobby', async () => {
    markReadyUseCase.execute.mockResolvedValue({
      id: 'l1',
      status: 'ready',
      playerIds: ['p1', 'p2'],
      readyPlayerIds: ['p1', 'p2'],
    });

    const response = await request(app)
      .post('/lobby/l1/ready')
      .send({ playerId: 'p2' });

    expect(response.status).toBe(200);
    expect(markReadyUseCase.execute).toHaveBeenCalledWith({ lobbyId: 'l1', playerId: 'p2' });
    expect(response.body.status).toBe('ready');
  });

  it('GET /lobby/active returns 200 when lobby exists', async () => {
    lobbyRepository.findActive.mockResolvedValue({
      id: 'l1',
      status: 'waiting',
      playerIds: [],
      readyPlayerIds: [],
    });

    const response = await request(app).get('/lobby/active');

    expect(response.status).toBe(200);
    expect(response.body.id).toBe('l1');
  });

  it('GET /lobby/:lobbyId returns 404 when lobby does not exist', async () => {
    lobbyRepository.findById.mockResolvedValue(null);

    const response = await request(app).get('/lobby/unknown');

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Lobby not found');
  });

  it('maps ValidationError to 400', async () => {
    joinLobbyUseCase.execute.mockRejectedValue(new ValidationError('Invalid nickname'));

    const response = await request(app).post('/lobby/join').send({ nickname: '' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid nickname');
  });

  it('maps NotFoundError to 404', async () => {
    assignTeamUseCase.execute.mockRejectedValue(new NotFoundError('Lobby not found'));

    const response = await request(app)
      .post('/lobby/l1/assign-team')
      .send({ playerId: 'p1' });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Lobby not found');
  });

  it('maps ConflictError to 409', async () => {
    markReadyUseCase.execute.mockRejectedValue(new ConflictError('Lobby is full'));

    const response = await request(app)
      .post('/lobby/l1/ready')
      .send({ playerId: 'p1' });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('Lobby is full');
  });
});
