import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PokeAPIAdapter } from '../pokeapi.adapter.js';
import { InvalidConfigError } from '../../errors/InvalidConfig.error.js';
import { ThirdPartyApiFailedError } from '../../errors/ThirdPartyApiFailed.error.js';

describe('PokeAPIAdapter', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('throws InvalidConfigError when baseUrl is missing', () => {
    expect(() => new PokeAPIAdapter('')).toThrow(InvalidConfigError);
  });

  it('maps list response and caches it', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: [{ id: '1', name: 'bulbasaur' }, { id: '2', name: 'ivysaur' }],
      }),
    });

    const adapter = new PokeAPIAdapter('https://poke.test');
    const first = await adapter.getList();
    const second = await adapter.getList();

    expect(first).toEqual([
      { id: 1, name: 'bulbasaur' },
      { id: 2, name: 'ivysaur' },
    ]);
    expect(second).toEqual(first);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('maps detail response and caches by pokemon id', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        data: {
          id: '25',
          name: 'pikachu',
          hp: '35',
          attack: '55',
          defense: '40',
          speed: '90',
          sprite: 'https://example.com/pikachu.gif',
          type: ['Electric'],
        },
      }),
    });

    const adapter = new PokeAPIAdapter('https://poke.test');
    const first = await adapter.getById('25');
    const second = await adapter.getById(25);

    expect(first).toEqual({
      id: 25,
      name: 'pikachu',
      hp: 35,
      attack: 55,
      defense: 40,
      speed: 90,
      sprite: 'https://example.com/pikachu.gif',
      type: ['Electric'],
    });
    expect(second).toEqual(first);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('maps real API detail response (success + data with type array and sprite URL)', async () => {
    const apiResponse = {
      success: true,
      data: {
        id: 1,
        name: 'Bulbasaur',
        type: ['Grass', 'Poison'],
        hp: 45,
        attack: 49,
        defense: 49,
        speed: 45,
        sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/1.gif',
      },
    };
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(apiResponse),
    });

    const adapter = new PokeAPIAdapter('https://poke.test');
    const detail = await adapter.getById(1);

    expect(detail).toEqual({
      id: 1,
      name: 'Bulbasaur',
      hp: 45,
      attack: 49,
      defense: 49,
      speed: 45,
      sprite: apiResponse.data.sprite,
      type: ['Grass', 'Poison'],
    });
  });

  it('maps detail with missing sprite and type to empty string and array', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        data: { id: '7', name: 'squirtle', hp: '44', attack: '48', defense: '65', speed: '43' },
      }),
    });

    const adapter = new PokeAPIAdapter('https://poke.test');
    const detail = await adapter.getById(7);

    expect(detail.sprite).toBe('');
    expect(detail.type).toEqual([]);
    expect(detail.name).toBe('squirtle');
  });

  it('throws ThirdPartyApiFailedError on timeout', async () => {
    global.fetch.mockRejectedValue({ name: 'TimeoutError' });
    const adapter = new PokeAPIAdapter('https://poke.test');

    await expect(adapter.getList()).rejects.toMatchObject({
      name: ThirdPartyApiFailedError.name,
      status: 504,
    });
  });
});
