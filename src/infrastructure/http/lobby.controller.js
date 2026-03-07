import { Router } from 'express';
import { ValidationError } from '../../application/errors/Validation.error.js';
import { NotFoundError } from '../../application/errors/NotFound.error.js';
import { ConflictError } from '../../application/errors/Conflict.error.js';

export class LobbyController {
  constructor(joinLobbyUseCase, assignTeamUseCase, markReadyUseCase, lobbyRepository) {
    this.joinLobbyUseCase = joinLobbyUseCase;
    this.assignTeamUseCase = assignTeamUseCase;
    this.markReadyUseCase = markReadyUseCase;
    this.lobbyRepository = lobbyRepository;
  }

  getRouter() {
    const router = Router();

    router.post('/join', (req, res, next) => this.handleJoin(req, res).catch(next));
    router.post('/:lobbyId/assign-team', (req, res, next) => this.handleAssignTeam(req, res).catch(next));
    router.post('/:lobbyId/ready', (req, res, next) => this.handleMarkReady(req, res).catch(next));
    router.get('/active', (req, res, next) => this.handleGetActive(req, res).catch(next));
    router.get('/:lobbyId', (req, res, next) => this.handleGetById(req, res).catch(next));

    return router;
  }

  sendError(res, err) {
    res.status(this.statusFromError(err)).json({ error: err.message || 'Request failed' });
  }

  statusFromError(err) {
    if (err instanceof ValidationError && err.status != null) return err.status;
    if (err instanceof NotFoundError && err.status != null) return err.status;
    if (err instanceof ConflictError && err.status != null) return err.status;
    return 500;
  }

  async handleJoin(req, res) {
    try {
      const { nickname } = req.body ?? {};
      const result = await this.joinLobbyUseCase.execute({ nickname });
      res.status(201).json(result);
    } catch (err) {
      this.sendError(res, err);
    }
  }

  async handleAssignTeam(req, res) {
    try {
      const { lobbyId } = req.params;
      const { playerId } = req.body ?? {};
      const team = await this.assignTeamUseCase.execute({ lobbyId, playerId });
      res.status(200).json(team);
    } catch (err) {
      this.sendError(res, err);
    }
  }

  async handleMarkReady(req, res) {
    try {
      const { lobbyId } = req.params;
      const { playerId } = req.body ?? {};
      const lobby = await this.markReadyUseCase.execute({ lobbyId, playerId });
      res.status(200).json(lobby);
    } catch (err) {
      this.sendError(res, err);
    }
  }

  async handleGetActive(req, res) {
    try {
      const lobby = await this.lobbyRepository.findActive();
      if (!lobby) {
        throw new NotFoundError('No active lobby');
      }
      res.status(200).json(lobby);
    } catch (err) {
      this.sendError(res, err);
    }
  }

  async handleGetById(req, res) {
    try {
      const { lobbyId } = req.params;
      const lobby = await this.lobbyRepository.findById(lobbyId);
      if (!lobby) {
        throw new NotFoundError('Lobby not found');
      }
      res.status(200).json(lobby);
    } catch (err) {
      this.sendError(res, err);
    }
  }
}
