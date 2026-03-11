import { InvalidConfigError } from '../errors/InvalidConfig.error.js';
import { ThirdPartyApiFailedError } from '../errors/ThirdPartyApiFailed.error.js';

function toSafeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapPokemonListItem(raw) {
  return {
    id: toSafeNumber(raw?.id, NaN),
    name: typeof raw?.name === 'string' ? raw.name : '',
  };
}

function toTypes(value) {
  if (Array.isArray(value)) {
    return value.filter((t) => typeof t === 'string').slice(0, 2);
  }
  if (typeof value === 'string' && value) return [value];
  return [];
}

function mapPokemonDetail(raw) {
  return {
    id: toSafeNumber(raw?.id, NaN),
    name: typeof raw?.name === 'string' ? raw.name : '',
    hp: toSafeNumber(raw?.hp, 0),
    attack: toSafeNumber(raw?.attack, 0),
    defense: toSafeNumber(raw?.defense, 0),
    speed: toSafeNumber(raw?.speed, 0),
    sprite: typeof raw?.sprite === 'string' && raw.sprite ? raw.sprite : '',
    type: toTypes(raw?.type ?? raw?.types),
  };
}

export class PokeAPIAdapter {
  constructor(baseUrl, options = {}) {
    if (!baseUrl) {
      throw new InvalidConfigError('POKEAPI_BASE_URL environment variable is not set');
    }

    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.cache = new Map();
  }

  async getList() {
    const cacheKey = 'list';
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const body = await this.fetchJson('/list', 'list');
    const rawList = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
    const mapped = rawList
      .map(mapPokemonListItem)
      .filter((item) => Number.isFinite(item.id));

    this.saveToCache(cacheKey, mapped);
    return mapped;
  }

  async getById(id) {
    const parsedId = Number(id);
    if (!Number.isFinite(parsedId)) {
      throw new InvalidConfigError('Pokemon id must be a valid number');
    }

    const cacheKey = `detail:${parsedId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const body = await this.fetchJson(`/list/${encodeURIComponent(parsedId)}`, 'detail');
    const rawDetail = body?.success === true && body.data != null ? body.data : body;
    const mapped = mapPokemonDetail(rawDetail);
    if (!Number.isFinite(mapped.id)) {
      throw new ThirdPartyApiFailedError('PokeAPI detail payload is missing a valid id', 502);
    }

    this.saveToCache(cacheKey, mapped);
    return mapped;
  }

  async fetchJson(path, operation) {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        throw new ThirdPartyApiFailedError(
          `PokeAPI ${operation} failed: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      return response.json();
    } catch (err) {
      if (err instanceof ThirdPartyApiFailedError) {
        throw err;
      }

      if (err?.name === 'AbortError' || err?.name === 'TimeoutError') {
        throw new ThirdPartyApiFailedError(`PokeAPI ${operation} timed out`, 504);
      }

      throw new ThirdPartyApiFailedError(`PokeAPI ${operation} failed`, 502);
    }
  }

  getFromCache(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  saveToCache(key, value) {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
  }
}
