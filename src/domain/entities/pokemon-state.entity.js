/**
 * Pokémon state (in battle) entity shape. No MongoDB or framework dependencies.
 * @typedef {{ id?: string, battleId: string, pokemonId: number, playerId: string, currentHp: number, defeated: boolean }} PokemonState
 */

export const BATTLE_ID_KEY = 'battleId';
export const POKEMON_ID_KEY = 'pokemonId';
export const PLAYER_ID_KEY = 'playerId';
export const CURRENT_HP_KEY = 'currentHp';
export const DEFEATED_KEY = 'defeated';
