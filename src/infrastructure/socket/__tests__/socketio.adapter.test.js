import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SocketIOAdapter } from '../socketio.adapter.js';

describe('SocketIOAdapter', () => {
  let mockIo;
  let emitMock;

  beforeEach(() => {
    emitMock = jest.fn();
    mockIo = {
      to: jest.fn().mockReturnValue({ emit: emitMock }),
    };
  });

  it('roomName returns lobby: prefix plus lobbyId', () => {
    const adapter = new SocketIOAdapter(mockIo);
    expect(adapter.roomName('abc123')).toBe('lobby:abc123');
  });

  it('notifyLobbyStatus emits lobby_status to correct room', () => {
    const adapter = new SocketIOAdapter(mockIo);
    const payload = { lobby: { id: 'l1', status: 'waiting' } };

    adapter.notifyLobbyStatus('l1', payload);

    expect(mockIo.to).toHaveBeenCalledWith('lobby:l1');
    expect(emitMock).toHaveBeenCalledWith('lobby_status', payload);
  });

  it('notifyBattleStart emits battle_start to correct room', () => {
    const adapter = new SocketIOAdapter(mockIo);
    const payload = { battleId: 'b1', lobbyId: 'l1' };

    adapter.notifyBattleStart('l1', payload);

    expect(mockIo.to).toHaveBeenCalledWith('lobby:l1');
    expect(emitMock).toHaveBeenCalledWith('battle_start', payload);
  });

  it('notifyTurnResult emits turn_result to correct room', () => {
    const adapter = new SocketIOAdapter(mockIo);
    const payload = { damage: 10, remainingHp: 90 };

    adapter.notifyTurnResult('l2', payload);

    expect(mockIo.to).toHaveBeenCalledWith('lobby:l2');
    expect(emitMock).toHaveBeenCalledWith('turn_result', payload);
  });

  it('notifyBattleEnd emits battle_end to correct room', () => {
    const adapter = new SocketIOAdapter(mockIo);
    const payload = { winnerId: 'p1', battleId: 'b1' };

    adapter.notifyBattleEnd('l1', payload);

    expect(mockIo.to).toHaveBeenCalledWith('lobby:l1');
    expect(emitMock).toHaveBeenCalledWith('battle_end', payload);
  });
});
