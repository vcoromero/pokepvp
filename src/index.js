import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PokeAPIAdapter } from './infrastructure/clients/pokeapi.adapter.js';
import { GetPokemonListUseCase } from './application/use-cases/get-pokemon-list.use-case.js';
import { GetPokemonByIdUseCase } from './application/use-cases/get-pokemon-by-id.use-case.js';
import { CatalogController } from './infrastructure/http/catalog.controller.js';
import { ThirdPartyApiFailedError } from './infrastructure/errors/ThirdPartyApiFailed.error.js';
import { InvalidConfigError } from './infrastructure/errors/InvalidConfig.error.js';

const PORT = Number(process.env.PORT) || 8080;
const HOST = '0.0.0.0';

const catalogPort = PokeAPIAdapter;

const getPokemonListUseCase = new GetPokemonListUseCase(catalogPort);
const getPokemonByIdUseCase = new GetPokemonByIdUseCase(catalogPort);

const catalogController = new CatalogController(getPokemonListUseCase, getPokemonByIdUseCase);

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

app.use((err, req, res, next) => {
  console.error(err);
  const status =
    err instanceof ThirdPartyApiFailedError && err.status != null
      ? (err.status >= 500 ? 503 : err.status >= 400 ? err.status : 502)
      : err instanceof InvalidConfigError
        ? 500
        : 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, HOST, () => {
  console.log(`PokePVP server listening on http://${HOST}:${PORT}`);
});
