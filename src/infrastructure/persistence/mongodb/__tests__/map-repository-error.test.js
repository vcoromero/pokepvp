import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { throwMappedError } from '../map-repository-error.js';
import { ValidationError } from '../../../../application/errors/Validation.error.js';
import { ConflictError } from '../../../../application/errors/Conflict.error.js';

describe('throwMappedError', () => {
  it('throws ValidationError when given Mongoose ValidationError', () => {
    const err = new mongoose.Error.ValidationError();
    err.message = 'Validation failed';

    expect(() => throwMappedError(err)).toThrow(ValidationError);
    expect(() => throwMappedError(err)).toThrow('Validation failed');
  });

  it('throws ValidationError when given Mongoose CastError', () => {
    const err = new mongoose.Error.CastError('ObjectId', 'invalid', '_id');

    expect(() => throwMappedError(err)).toThrow(ValidationError);
  });

  it('throws ConflictError when error has code 11000', () => {
    const err = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });

    expect(() => throwMappedError(err)).toThrow(ConflictError);
    expect(() => throwMappedError(err)).toThrow('E11000 duplicate key');
  });

  it('throws ConflictError with default message when code 11000 and no message', () => {
    const err = { code: 11000, message: '' };

    expect(() => throwMappedError(err)).toThrow(ConflictError);
    expect(() => throwMappedError(err)).toThrow('Duplicate key');
  });

  it('rethrows unknown errors', () => {
    const err = new Error('Some other error');

    expect(() => throwMappedError(err)).toThrow('Some other error');
    expect(() => throwMappedError(err)).toThrow(Error);
  });
});
