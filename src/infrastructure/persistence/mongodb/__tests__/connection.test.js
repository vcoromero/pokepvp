import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { connect, getConnection } from '../connection.js';

describe('connection', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('connect', () => {
    it('throws when MONGODB_URI is not set', async () => {
      delete process.env.MONGODB_URI;

      await expect(connect()).rejects.toThrow(
        'MONGODB_URI is required for persistence'
      );
    });

    it('throws when MONGODB_URI is empty string', async () => {
      process.env.MONGODB_URI = '';

      await expect(connect()).rejects.toThrow(
        'MONGODB_URI is required for persistence'
      );
    });

    it('throws when MONGODB_URI is whitespace only', async () => {
      process.env.MONGODB_URI = '   ';

      await expect(connect()).rejects.toThrow(
        'MONGODB_URI is required for persistence'
      );
    });
  });

  describe('getConnection', () => {
    it('returns null when not connected', () => {
      expect(getConnection()).toBeNull();
    });
  });
});
