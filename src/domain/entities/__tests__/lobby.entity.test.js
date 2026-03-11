import { describe, it, expect } from '@jest/globals';
import { Lobby } from '../lobby.entity.js';

describe('Lobby', () => {
  describe('from()', () => {
    it('creates a Lobby instance from a plain object', () => {
      const lobby = Lobby.from({ id: 'l1', status: 'waiting', playerIds: ['p1'], readyPlayerIds: [] });
      expect(lobby).toBeInstanceOf(Lobby);
      expect(lobby.id).toBe('l1');
    });

    it('returns null when given null', () => {
      expect(Lobby.from(null)).toBeNull();
    });
  });

  describe('isFull()', () => {
    it('returns false when fewer than 2 players', () => {
      expect(new Lobby({ playerIds: ['p1'] }).isFull()).toBe(false);
    });

    it('returns true when 2 players', () => {
      expect(new Lobby({ playerIds: ['p1', 'p2'] }).isFull()).toBe(true);
    });
  });

  describe('canJoin()', () => {
    it('returns true when waiting and not full', () => {
      expect(new Lobby({ status: 'waiting', playerIds: ['p1'] }).canJoin()).toBe(true);
    });

    it('returns false when full', () => {
      expect(new Lobby({ status: 'waiting', playerIds: ['p1', 'p2'] }).canJoin()).toBe(false);
    });

    it('returns false when not waiting', () => {
      expect(new Lobby({ status: 'battling', playerIds: ['p1'] }).canJoin()).toBe(false);
    });
  });

  describe('canAssignTeams()', () => {
    it('returns true when waiting', () => {
      expect(new Lobby({ status: 'waiting' }).canAssignTeams()).toBe(true);
    });

    it('returns false when not waiting', () => {
      expect(new Lobby({ status: 'ready' }).canAssignTeams()).toBe(false);
    });
  });

  describe('hasPlayer()', () => {
    it('returns true when player is in lobby', () => {
      expect(new Lobby({ playerIds: ['p1', 'p2'] }).hasPlayer('p1')).toBe(true);
    });

    it('returns false when player is not in lobby', () => {
      expect(new Lobby({ playerIds: ['p1'] }).hasPlayer('p2')).toBe(false);
    });
  });

  describe('addPlayer()', () => {
    it('returns a new Lobby with the player added', () => {
      const lobby = new Lobby({ id: 'l1', playerIds: ['p1'] });
      const updated = lobby.addPlayer('p2');

      expect(updated).not.toBe(lobby);
      expect(updated.playerIds).toEqual(['p1', 'p2']);
      expect(lobby.playerIds).toEqual(['p1']);
    });
  });

  describe('markReady()', () => {
    it('returns a new Lobby with the player in readyPlayerIds', () => {
      const lobby = new Lobby({ playerIds: ['p1', 'p2'], readyPlayerIds: [] });
      const updated = lobby.markReady('p1');

      expect(updated).not.toBe(lobby);
      expect(updated.readyPlayerIds).toEqual(['p1']);
      expect(lobby.readyPlayerIds).toEqual([]);
    });

    it('is idempotent for already-ready player', () => {
      const lobby = new Lobby({ playerIds: ['p1', 'p2'], readyPlayerIds: ['p1'] });
      const updated = lobby.markReady('p1');
      expect(updated.readyPlayerIds).toEqual(['p1']);
    });
  });

  describe('isAlreadyReady()', () => {
    it('returns true when player is in readyPlayerIds', () => {
      expect(new Lobby({ readyPlayerIds: ['p1'] }).isAlreadyReady('p1')).toBe(true);
    });

    it('returns false when player is not ready', () => {
      expect(new Lobby({ readyPlayerIds: [] }).isAlreadyReady('p1')).toBe(false);
    });
  });

  describe('isEveryoneReady()', () => {
    it('returns true when both players are ready', () => {
      const lobby = new Lobby({ playerIds: ['p1', 'p2'], readyPlayerIds: ['p1', 'p2'] });
      expect(lobby.isEveryoneReady()).toBe(true);
    });

    it('returns false when only one player is ready', () => {
      const lobby = new Lobby({ playerIds: ['p1', 'p2'], readyPlayerIds: ['p1'] });
      expect(lobby.isEveryoneReady()).toBe(false);
    });

    it('returns false when lobby has fewer than 2 players', () => {
      const lobby = new Lobby({ playerIds: ['p1'], readyPlayerIds: ['p1'] });
      expect(lobby.isEveryoneReady()).toBe(false);
    });
  });

  describe('withStatus()', () => {
    it('returns a new Lobby with the given status', () => {
      const lobby = new Lobby({ id: 'l1', status: 'waiting' });
      const updated = lobby.withStatus('ready');

      expect(updated).not.toBe(lobby);
      expect(updated.status).toBe('ready');
      expect(lobby.status).toBe('waiting');
    });
  });

  describe('toPlain()', () => {
    it('returns a plain object with all defined fields', () => {
      const lobby = new Lobby({ id: 'l1', status: 'waiting', playerIds: ['p1'], readyPlayerIds: [] });
      expect(lobby.toPlain()).toEqual({
        id: 'l1',
        status: 'waiting',
        playerIds: ['p1'],
        readyPlayerIds: [],
      });
    });

    it('omits id and createdAt when undefined', () => {
      const plain = new Lobby().toPlain();
      expect(plain).toEqual({
        status: 'waiting',
        playerIds: [],
        readyPlayerIds: [],
      });
      expect('id' in plain).toBe(false);
      expect('createdAt' in plain).toBe(false);
    });
  });
});
