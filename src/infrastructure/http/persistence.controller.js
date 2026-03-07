import { Router } from 'express';
import { LOBBY_STATUSES } from '../../domain/entities/lobby.entity.js';
import { ValidationError } from '../errors/Validation.error.js';
import { NotFoundError } from '../errors/NotFound.error.js';
import { ConflictError } from '../errors/Conflict.error.js';

export class PersistenceController {
  constructor(lobbyRepository, playerRepository) {
    this.lobbyRepository = lobbyRepository;
    this.playerRepository = playerRepository;
  }

  getRouter() {
    const router = Router();
    router.post('/lobby', (req, res, next) => this.handlePostLobby(req, res).catch(next));
    router.get('/lobby/active', (req, res, next) => this.handleGetLobbyActive(req, res).catch(next));
    router.post('/player', (req, res, next) => this.handlePostPlayer(req, res).catch(next));
    return router;
  }

  sendError(res, err) {
    const status = this.statusFromError(err);
    res.status(status).json({ error: err.message || 'Request failed' });
  }

  statusFromError(err) {
    if (err instanceof ValidationError && err.status != null) return err.status;
    if (err instanceof NotFoundError && err.status != null) return err.status;
    if (err instanceof ConflictError && err.status != null) return err.status;
    return 500;
  }

  async handlePostLobby(req, res) {
    try {
      const { status = 'waiting', playerIds = [] } = req.body ?? {};
      if (!LOBBY_STATUSES.includes(status)) {
        throw new ValidationError(`status must be one of: ${LOBBY_STATUSES.join(', ')}`);
      }
      if (!Array.isArray(playerIds)) {
        throw new ValidationError('playerIds must be an array');
      }
      const lobby = await this.lobbyRepository.save({ status, playerIds });
      res.status(201).json(lobby);
    } catch (err) {
      this.sendError(res, err);
    }
  }

  async handleGetLobbyActive(req, res) {
    try {
      const lobby = await this.lobbyRepository.findActive();
      if (!lobby) {
        throw new NotFoundError('No active lobby');
      }
      res.json(lobby);
    } catch (err) {
      this.sendError(res, err);
    }
  }

  async handlePostPlayer(req, res) {
    try {
      const { nickname } = req.body ?? {};
      if (nickname == null || typeof nickname !== 'string') {
        throw new ValidationError('nickname is required and must be a string');
      }
      const trimmed = nickname.trim();
      if (trimmed.length === 0) {
        throw new ValidationError('nickname cannot be empty');
      }
      const player = await this.playerRepository.save({ nickname: trimmed });
      res.status(201).json(player);
    } catch (err) {
      this.sendError(res, err);
    }
  }
}
