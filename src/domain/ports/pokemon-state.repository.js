/**
 * Pokemon state repository output port.
 * Domain defines the contract; infrastructure (e.g. mongo adapter) implements it.
 *
 * @typedef {import('../entities/pokemon-state.entity.js').PokemonState} PokemonState
 * @typedef {Object} PokemonStateRepository
 * @property {(state: Partial<PokemonState>) => Promise<PokemonState>} save
 * @property {(battleId: string) => Promise<PokemonState[]>} findByBattleId
 * @property {(states: Partial<PokemonState>[]) => Promise<PokemonState[]>} [saveMany]
 */

// Adapter passed at bootstrap must implement save(state), findByBattleId(battleId); saveMany is optional.
