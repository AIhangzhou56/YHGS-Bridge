import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Production-safe WebSocket configuration
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
  // In production, check if WebSocket is available
  if (typeof globalThis.WebSocket === 'undefined') {
    neonConfig.webSocketConstructor = ws;
  }
} else {
  // In development, always use ws module
  neonConfig.webSocketConstructor = ws;
}

// Disable fetch for production compatibility
neonConfig.fetchConnectionCache = true;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure connection pool for production
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

export const pool = new Pool(poolConfig);
export const db = drizzle({ client: pool, schema });