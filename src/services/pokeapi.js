const getBaseUrl = () => {
  const url = process.env.POKEAPI_BASE_URL;
  if (!url) {
    throw new Error('POKEAPI_BASE_URL environment variable is not set');
  }
  return url.replace(/\/$/, '');
};

/**
 * Fetches the full Pokémon list from the external API.
 * @returns {Promise<Array>} List of Pokémon (at least id, name).
 */
async function fetchList() {
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/list`);
  if (!response.ok) {
    const err = new Error(`PokeAPI list failed: ${response.status} ${response.statusText}`);
    err.status = response.status;
    throw err;
  }
  return response.json();
}

/**
 * Fetches a single Pokémon by id from the external API.
 * @param {string|number} id - Pokémon id.
 * @returns {Promise<Object>} Pokémon detail (id, name, type, hp, attack, defense, speed, sprite).
 */
async function fetchById(id) {
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/list/${encodeURIComponent(id)}`);
  if (!response.ok) {
    const err = new Error(`PokeAPI detail failed: ${response.status} ${response.statusText}`);
    err.status = response.status;
    throw err;
  }
  return response.json();
}

module.exports = {
  fetchList,
  fetchById,
};
