import { ValidationError } from '../../application/errors/Validation.error.js';

const MAX_LENGTH = 30;

export class Nickname {
  constructor(value) {
    if (value == null || typeof value !== 'string') {
      throw new ValidationError('nickname is required and must be a string');
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new ValidationError('nickname cannot be empty');
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new ValidationError(`nickname must be ${MAX_LENGTH} characters or fewer`);
    }

    this.value = trimmed;
  }

  toString() {
    return this.value;
  }
}
