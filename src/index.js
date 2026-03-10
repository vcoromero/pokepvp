import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { connect } from './infrastructure/persistence/mongodb/connection.js';
import { PokeAPIAdapter } from './infrastructure/clients/pokeapi.adapter.js';
import { JoinLobbyUseCase } from './application/use-cases/join-lobby.use-case.js';
import { AssignTeamUseCase } from './application/use-cases/assign-team.use-case.js';
import { MarkReadyUseCase } from './application/use-cases/mark-ready.use-case.js';
import { StartBattleUseCase } from './application/use-cases/start-battle.use-case.js';
import { ProcessAttackUseCase } from './application/use-cases/process-attack.use-case.js';
import { SocketIOAdapter } from './infrastructure/socket/socketio.adapter.js';
import { SocketHandler } from './infrastructure/socket/socket.handler.js';
import { PlayerMongoRepository } from './infrastructure/persistence/mongodb/adapters/player.mongo.repository.js';
import { LobbyMongoRepository } from './infrastructure/persistence/mongodb/adapters/lobby.mongo.repository.js';
import { TeamMongoRepository } from './infrastructure/persistence/mongodb/adapters/team.mongo.repository.js';
import { BattleMongoRepository } from './infrastructure/persistence/mongodb/adapters/battle.mongo.repository.js';
import { PokemonStateMongoRepository } from './infrastructure/persistence/mongodb/adapters/pokemon-state.mongo.repository.js';

const PORT = Number(process.env.PORT) || 8080;
const HOST = '0.0.0.0';

async function start() {
  if (process.env.MONGODB_URI) {
    await connect();
  }

  const app = createApp();
  const server = http.createServer(app);

  const io = new Server(server, {
    path: '/socket.io',
    cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:3000' },
  });

  if (process.env.MONGODB_URI) {
    const repositories = {
      playerRepository: new PlayerMongoRepository(),
      lobbyRepository: new LobbyMongoRepository(),
      teamRepository: new TeamMongoRepository(),
      battleRepository: new BattleMongoRepository(),
      pokemonStateRepository: new PokemonStateMongoRepository(),
    };
    const catalogPort = PokeAPIAdapter;
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
    const realtimePort = new SocketIOAdapter(io);
    const startBattleUseCase = new StartBattleUseCase(
      repositories.lobbyRepository,
      repositories.teamRepository,
      repositories.battleRepository,
      repositories.pokemonStateRepository,
      catalogPort,
      realtimePort
    );
    const processAttackUseCase = new ProcessAttackUseCase(
      repositories.lobbyRepository,
      repositories.teamRepository,
      repositories.battleRepository,
      repositories.pokemonStateRepository,
      catalogPort,
      realtimePort
    );
    const socketHandler = new SocketHandler(
      joinLobbyUseCase,
      assignTeamUseCase,
      markReadyUseCase,
      startBattleUseCase,
      processAttackUseCase,
      realtimePort,
      repositories.lobbyRepository
    );
    socketHandler.attach(io);
  }

  server.listen(PORT, HOST, () => {
    console.log(`PokePVP server listening on http://${HOST}:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
