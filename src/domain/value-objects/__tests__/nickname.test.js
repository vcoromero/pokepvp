import { describe, it, expect } from '@jest/globals';
import { Nickname } from '../nickname.js';
import { ValidationError } from '../../../application/errors/Validation.error.js';

describe('Nickname', () => {
  it('trims whitespace and stores the value', () => {
    const nick = new Nickname('  Ash  ');
    expect(nick.value).toBe('Ash');
    expect(nick.toString()).toBe('Ash');
  });

  it('accepts valid nickname at max length (30)', () => {
    const name = 'A'.repeat(30);
    const nick = new Nickname(name);
    expect(nick.value).toBe(name);
  });

  it('throws ValidationError for null', () => {
    expect(() => new Nickname(null)).toThrow(ValidationError);
  });

  it('throws ValidationError for non-string', () => {
    expect(() => new Nickname(42)).toThrow(ValidationError);
  });

  it('throws ValidationError for empty string', () => {
    expect(() => new Nickname('   ')).toThrow(ValidationError);
  });

  it('throws ValidationError when exceeding 30 characters', () => {
    expect(() => new Nickname('A'.repeat(31))).toThrow(
      'nickname must be 30 characters or fewer'
    );
  });
});
