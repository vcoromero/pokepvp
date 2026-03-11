import { describe, it, expect } from '@jest/globals';
import { calculateDamage } from '../damage-calculator.js';

describe('calculateDamage', () => {
  it('returns attack minus defense', () => {
    expect(calculateDamage(60, 40)).toBe(20);
  });

  it('returns minimum of 1 when defense exceeds attack', () => {
    expect(calculateDamage(10, 100)).toBe(1);
  });

  it('returns minimum of 1 when attack equals defense', () => {
    expect(calculateDamage(50, 50)).toBe(1);
  });

  it('handles null/undefined stats as 0', () => {
    expect(calculateDamage(null, 30)).toBe(1);
    expect(calculateDamage(50, undefined)).toBe(50);
  });
});
