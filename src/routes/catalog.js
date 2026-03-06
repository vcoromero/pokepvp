const express = require('express');
const pokeapi = require('../services/pokeapi');

const router = express.Router();

router.get('/list', async (req, res) => {
  try {
    const data = await pokeapi.fetchList();
    res.json(data);
  } catch (err) {
    const status = err.status >= 500 ? 503 : (err.status >= 400 ? err.status : 502);
    res.status(status).json({
      error: err.message || 'Failed to fetch Pokémon list',
    });
  }
});

router.get('/list/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await pokeapi.fetchById(id);
    res.json(data);
  } catch (err) {
    const status = err.status >= 500 ? 503 : (err.status >= 400 ? err.status : 502);
    res.status(status).json({
      error: err.message || 'Failed to fetch Pokémon detail',
    });
  }
});

module.exports = router;
