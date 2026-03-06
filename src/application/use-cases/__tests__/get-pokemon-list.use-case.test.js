import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GetPokemonListUseCase } from '../get-pokemon-list.use-case.js';

describe('GetPokemonListUseCase', () => {
  let useCase;
  let mockCatalogPort;

  beforeEach(() => {
    mockCatalogPort = {
      getList: jest.fn(),
    };
    useCase = new GetPokemonListUseCase(mockCatalogPort);
  });

  it('calls catalog port getList once', async () => {
    const list = [{ id: 1, name: 'bulbasaur' }];
    mockCatalogPort.getList.mockResolvedValue(list);

    const result = await useCase.execute();

    expect(mockCatalogPort.getList).toHaveBeenCalledTimes(1);
    expect(mockCatalogPort.getList).toHaveBeenCalledWith();
    expect(result).toEqual(list);
  });

  it('returns empty array when port returns empty list', async () => {
    mockCatalogPort.getList.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result).toEqual([]);
  });

  it('propagates errors from catalog port', async () => {
    const error = new Error('Network error');
    mockCatalogPort.getList.mockRejectedValue(error);

    await expect(useCase.execute()).rejects.toThrow('Network error');
  });
});
