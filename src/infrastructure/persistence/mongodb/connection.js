import mongoose from 'mongoose';

let connectionPromise = null;

export async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.trim() === '') {
    throw new Error('MONGODB_URI is required for persistence. Set it in .env or skip persistence routes.');
  }
  if (connectionPromise) {
    return connectionPromise;
  }
  connectionPromise = mongoose.connect(uri).then((conn) => {
    return conn;
  }).catch((err) => {
    connectionPromise = null;
    console.error('MongoDB connection error:', err.message);
    throw err;
  });
  return connectionPromise;
}

export function getConnection() {
  return mongoose.connection?.readyState === 1 ? mongoose.connection : null;
}
