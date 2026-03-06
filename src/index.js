import 'dotenv/config';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT) || 8080;
const HOST = '0.0.0.0';

const app = createApp();
app.listen(PORT, HOST, () => {
  console.log(`PokePVP server listening on http://${HOST}:${PORT}`);
});
