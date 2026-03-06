import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GetPokemonByIdUseCase } from '../get-pokemon-by-id.use-case.js';

describe('GetPokemonByIdUseCase', () => {
  let useCase;
  let mockCatalogPort;

  beforeEach(() => {
    mockCatalogPort = {
      getById: jest.fn(),
    };
    useCase = new GetPokemonByIdUseCase(mockCatalogPort);
  });

  it('calls catalog port getById with given id', async () => {
    const pokemon = { id: 7, name: 'squirtle' };
    mockCatalogPort.getById.mockResolvedValue(pokemon);

    const result = await useCase.execute('7');

    expect(mockCatalogPort.getById).toHaveBeenCalledTimes(1);
    expect(mockCatalogPort.getById).toHaveBeenCalledWith('7');
    expect(result).toEqual(pokemon);
  });

  it('propagates errors from catalog port', async () => {
    const error = new Error('Not found');
    mockCatalogPort.getById.mockRejectedValue(error);

    await expect(useCase.execute('999')).rejects.toThrow('Not found');
  });
});
