import { Router } from 'express';
import { ThirdPartyApiFailedError } from '../errors/ThirdPartyApiFailed.error.js';
import { InvalidConfigError } from '../errors/InvalidConfig.error.js';

export class CatalogController {
    constructor(getPokemonListUseCase, getPokemonByIdUseCase) {
        this.getPokemonListUseCase = getPokemonListUseCase;
        this.getPokemonByIdUseCase = getPokemonByIdUseCase;
    }

    getRouter() {
        const router = Router();
        router.get('/list', (req, res, next) => this.handleGetList(req, res).catch(next));
        router.get('/list/:id', (req, res, next) => this.handleGetById(req, res).catch(next));
        return router;
    }

    async handleGetList(req, res) {
        try {
            const data = await this.getPokemonListUseCase.execute();
            res.json(data);
        } catch (err) {
            this.sendError(res, err);
        }
    }

    async handleGetById(req, res) {
        try {
            const { id } = req.params;
            const data = await this.getPokemonByIdUseCase.execute(id);
            res.json(data);
        } catch (err) {
            this.sendError(res, err);
        }
    }

    sendError(res, err) {
        const status = this.statusFromError(err);
        res.status(status).json({ error: err.message || 'Request failed' });
    }

    statusFromError(err) {
        if (err instanceof ThirdPartyApiFailedError && err.status != null) {
            return err.status >= 500 ? 503 : (err.status >= 400 ? err.status : 502);
        }
        if (err instanceof InvalidConfigError) {
            return 500;
        }
        return 500;
    }
}