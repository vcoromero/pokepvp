require('dotenv').config();
const express = require('express');
const catalogRoutes = require('./routes/catalog');

const PORT = Number(process.env.PORT) || 8080;
const HOST = '0.0.0.0';

const app = express();

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/catalog', catalogRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, HOST, () => {
  console.log(`PokePVP server listening on http://${HOST}:${PORT}`);
});
