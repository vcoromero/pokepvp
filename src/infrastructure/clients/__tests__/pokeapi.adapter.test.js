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
        data: { id: '25', name: 'pikachu', hp: '35', attack: '55', defense: '40', speed: '90' },
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
    });
    expect(second).toEqual(first);
    expect(global.fetch).toHaveBeenCalledTimes(1);
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
