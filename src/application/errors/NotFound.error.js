export class NotFoundError extends Error {
  constructor(message, status = 404) {
    super(message);
    this.name = 'NotFoundError';
    this.status = status;
  }
}
