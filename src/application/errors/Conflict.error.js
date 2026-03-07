export class ConflictError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.name = 'ConflictError';
    this.status = status;
  }
}
