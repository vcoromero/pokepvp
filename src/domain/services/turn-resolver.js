/**
 * Resolves who acts first based on Speed, with deterministic tiebreakers.
 * @returns {string} The playerId who attacks first
 */
export function resolveFirstTurn({ speedA, speedB, playerIdA, playerIdB, pokemonIdA, pokemonIdB }) {
  if (speedA > speedB) return playerIdA;
  if (speedB > speedA) return playerIdB;

  const cmp = (playerIdA || '').localeCompare(playerIdB || '');
  if (cmp < 0) return playerIdA;
  if (cmp > 0) return playerIdB;

  return (pokemonIdA ?? 0) <= (pokemonIdB ?? 0) ? playerIdA : playerIdB;
}
