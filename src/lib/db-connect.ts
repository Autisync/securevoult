import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

// In production, a missing URI is a hard failure — fail immediately so the
// error surfaces at startup rather than producing opaque Mongoose errors at
// request time.  In development we allow a missing URI so the app can be
// explored without a MongoDB instance, but every route that needs the DB will
// return a 503 because connectDB() throws below.
if (!MONGODB_URI && process.env.NODE_ENV === 'production') {
  throw new Error('[SecureVoult] MONGODB_URI environment variable is required in production.');
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: MongooseCache | undefined;
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (!MONGODB_URI) {
    throw new Error(
      'MONGODB_URI is not configured. Set it in .env.local (development) or your deployment environment (production).'
    );
  }

  if (cached!.conn) {
    return cached!.conn;
  }

  if (!cached!.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000,
    };

    cached!.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('Connected to MongoDB');
      return mongoose;
    }).catch((error) => {
      console.error('MongoDB connection failed:', error.message);
      cached!.promise = null;
      throw error;
    });
  }

  try {
    cached!.conn = await cached!.promise;
  } catch (error) {
    cached!.promise = null;
    throw error;
  }

  return cached!.conn;
}

export default connectDB;