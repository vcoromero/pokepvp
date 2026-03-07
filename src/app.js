import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PokeAPIAdapter } from './infrastructure/clients/pokeapi.adapter.js';
import { GetPokemonListUseCase } from './application/use-cases/get-pokemon-list.use-case.js';
import { GetPokemonByIdUseCase } from './application/use-cases/get-pokemon-by-id.use-case.js';
import { JoinLobbyUseCase } from './application/use-cases/join-lobby.use-case.js';
import { AssignTeamUseCase } from './application/use-cases/assign-team.use-case.js';
import { MarkReadyUseCase } from './application/use-cases/mark-ready.use-case.js';
import { CatalogController } from './infrastructure/http/catalog.controller.js';
import { LobbyController } from './infrastructure/http/lobby.controller.js';
import { ThirdPartyApiFailedError } from './infrastructure/errors/ThirdPartyApiFailed.error.js';
import { InvalidConfigError } from './infrastructure/errors/InvalidConfig.error.js';
import { ValidationError } from './application/errors/Validation.error.js';
import { NotFoundError } from './application/errors/NotFound.error.js';
import { ConflictError } from './application/errors/Conflict.error.js';
import { PlayerMongoRepository } from './infrastructure/persistence/mongodb/adapters/player.mongo.repository.js';
import { LobbyMongoRepository } from './infrastructure/persistence/mongodb/adapters/lobby.mongo.repository.js';
import { TeamMongoRepository } from './infrastructure/persistence/mongodb/adapters/team.mongo.repository.js';
import { BattleMongoRepository } from './infrastructure/persistence/mongodb/adapters/battle.mongo.repository.js';
import { PokemonStateMongoRepository } from './infrastructure/persistence/mongodb/adapters/pokemon-state.mongo.repository.js';


export function createApp(options = {}) {
  const catalogPort = options.catalogPort ?? PokeAPIAdapter;
  const getPokemonListUseCase = new GetPokemonListUseCase(catalogPort);
  const getPokemonByIdUseCase = new GetPokemonByIdUseCase(catalogPort);
  const catalogController = new CatalogController(getPokemonListUseCase, getPokemonByIdUseCase);

  let repositories = options.repositories;
  if (!repositories && process.env.MONGODB_URI) {
    repositories = {
      playerRepository: new PlayerMongoRepository(),
      lobbyRepository: new LobbyMongoRepository(),
      teamRepository: new TeamMongoRepository(),
      battleRepository: new BattleMongoRepository(),
      pokemonStateRepository: new PokemonStateMongoRepository(),
    };
  }

  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    optionsSuccessStatus: 200,
  }));
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/catalog', catalogController.getRouter());

  if (repositories) {
    const joinLobbyUseCase = new JoinLobbyUseCase(
      repositories.playerRepository,
      repositories.lobbyRepository
    );
    const assignTeamUseCase = new AssignTeamUseCase(
      catalogPort,
      repositories.lobbyRepository,
      repositories.teamRepository
    );
    const markReadyUseCase = new MarkReadyUseCase(
      repositories.lobbyRepository,
      repositories.teamRepository
    );
    const lobbyController = new LobbyController(
      joinLobbyUseCase,
      assignTeamUseCase,
      markReadyUseCase,
      repositories.lobbyRepository
    );
    app.use('/lobby', lobbyController.getRouter());
  }

  app.use((err, req, res, next) => {
    console.error(err);
    const status = statusFromError(err);
    res.status(status).json({ error: err.message || 'Internal server error' });
  });

  return app;
}

function statusFromError(err) {
  if (err instanceof ThirdPartyApiFailedError && err.status != null) {
    return err.status >= 500 ? 503 : err.status >= 400 ? err.status : 502;
  }
  if (err instanceof InvalidConfigError) return 500;
  if (err instanceof ValidationError && err.status != null) return err.status;
  if (err instanceof NotFoundError && err.status != null) return err.status;
  if (err instanceof ConflictError && err.status != null) return err.status;
  return 500;
}
