export const LOBBY_STATUSES = Object.freeze(['waiting', 'ready', 'battling', 'finished']);

export class Lobby {
  constructor({ id, status = 'waiting', playerIds = [], readyPlayerIds = [], createdAt } = {}) {
    this.id = id;
    this.status = status;
    this.playerIds = [...playerIds];
    this.readyPlayerIds = [...readyPlayerIds];
    this.createdAt = createdAt;
  }

  static from(plain) {
    if (!plain) return null;
    return new Lobby(plain);
  }

  isFull() {
    return this.playerIds.length >= 2;
  }

  canJoin() {
    return this.status === 'waiting' && !this.isFull();
  }

  canAssignTeams() {
    return this.status === 'waiting';
  }

  hasPlayer(playerId) {
    return this.playerIds.includes(playerId);
  }

  addPlayer(playerId) {
    return new Lobby({
      ...this,
      playerIds: [...this.playerIds, playerId],
    });
  }

  markReady(playerId) {
    const readySet = new Set(this.readyPlayerIds);
    readySet.add(playerId);
    return new Lobby({
      ...this,
      readyPlayerIds: [...readySet],
    });
  }

  isAlreadyReady(playerId) {
    return this.readyPlayerIds.includes(playerId);
  }

  isEveryoneReady() {
    return (
      this.playerIds.length === 2 &&
      this.readyPlayerIds.length >= 2 &&
      this.playerIds.every((id) => this.readyPlayerIds.includes(id))
    );
  }

  withStatus(newStatus) {
    return new Lobby({ ...this, status: newStatus });
  }

  toPlain() {
    const plain = {
      status: this.status,
      playerIds: this.playerIds,
      readyPlayerIds: this.readyPlayerIds,
    };
    if (this.id != null) plain.id = this.id;
    if (this.createdAt != null) plain.createdAt = this.createdAt;
    return plain;
  }
}
