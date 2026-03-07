import mongoose from 'mongoose';
import { ValidationError } from '../../errors/Validation.error.js';
import { ConflictError } from '../../errors/Conflict.error.js';

/**
 * Maps Mongoose/Mongo errors to domain HTTP-friendly errors.
 * Call in repository catch blocks; rethrows the mapped or original error.
 * @param {Error} err
 */
export function mapRepositoryError(err) {
  if (err instanceof mongoose.Error.ValidationError) {
    throw new ValidationError(err.message);
  }
  if (err instanceof mongoose.Error.CastError) {
    throw new ValidationError(err.message || 'Invalid id');
  }
  if (err.code === 11000) {
    throw new ConflictError(err.message || 'Duplicate key');
  }
  throw err;
}
