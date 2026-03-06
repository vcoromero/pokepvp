/**
 * Catalog output port.
 * Domain defines the contract; infrastructure (e.g. pokeapi-adapter) implements it.
 *
 * @typedef {Object} CatalogPort
 * @property {() => Promise<Array<{id: number|string, name: string}>>} getList
 * @property {(id: string|number) => Promise<Object|null>} getById
 */

// In plain JS there is no "interface" type; the adapter passed at bootstrap
// must implement getList() and getById(id). Use cases depend on this shape.