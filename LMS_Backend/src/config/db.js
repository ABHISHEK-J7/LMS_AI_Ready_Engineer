import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';

// Don't queue queries when Mongo is unreachable — let routes return a clean
// error instead of hanging ~30s (same approach as the team's JinSei backend).
mongoose.set('bufferCommands', false);
mongoose.set('strictQuery', true);
// In production, indexes are built explicitly at boot (server.js) — don't also
// let Mongoose build them lazily mid-traffic on a large dataset.
mongoose.set('autoIndex', !env.isProd);

// Atlas SRV records sometimes fail through the OS resolver; pin public DNS.
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  /* non-fatal */
}

export async function connectDatabase() {
  mongoose.connection.on('connected', () => {
    // eslint-disable-next-line no-console
    console.log('[db] MongoDB connected');
  });
  mongoose.connection.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[db] MongoDB connection error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    // eslint-disable-next-line no-console
    console.warn('[db] MongoDB disconnected');
  });

  await mongoose.connect(env.mongoUri, {
    // Bounded pool + fail-fast timeouts so total connections stay within Atlas
    // limits as instances scale, and a hung server doesn't hang requests.
    maxPoolSize: Number(process.env.MONGO_MAX_POOL ?? 20),
    minPoolSize: Number(process.env.MONGO_MIN_POOL ?? 2),
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
  });
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
