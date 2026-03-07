import 'dotenv/config';
import { createApp } from './app.js';
import { connect } from './infrastructure/persistence/mongodb/connection.js';

const PORT = Number(process.env.PORT) || 8080;
const HOST = '0.0.0.0';

async function start() {
  if (process.env.MONGODB_URI) {
    await connect();
  }
  const app = createApp();
  app.listen(PORT, HOST, () => {
    console.log(`PokePVP server listening on http://${HOST}:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
