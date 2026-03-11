import { describe, it, expect } from '@jest/globals';
import { resolveFirstTurn } from '../turn-resolver.js';

describe('resolveFirstTurn', () => {
  const base = {
    speedA: 50,
    speedB: 30,
    playerIdA: 'p1',
    playerIdB: 'p2',
    pokemonIdA: 1,
    pokemonIdB: 4,
  };

  it('returns playerA when speedA > speedB', () => {
    expect(resolveFirstTurn(base)).toBe('p1');
  });

  it('returns playerB when speedB > speedA', () => {
    expect(resolveFirstTurn({ ...base, speedA: 20, speedB: 50 })).toBe('p2');
  });

  it('breaks speed tie using playerId comparison', () => {
    expect(resolveFirstTurn({ ...base, speedA: 50, speedB: 50 })).toBe('p1');
    expect(resolveFirstTurn({ ...base, speedA: 50, speedB: 50, playerIdA: 'z', playerIdB: 'a' })).toBe('a');
  });

  it('breaks full tie using pokemonId', () => {
    expect(resolveFirstTurn({
      speedA: 50,
      speedB: 50,
      playerIdA: 'same',
      playerIdB: 'same',
      pokemonIdA: 1,
      pokemonIdB: 4,
    })).toBe('same');
  });
});
