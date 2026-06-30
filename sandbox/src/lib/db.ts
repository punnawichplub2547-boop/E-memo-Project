import mysql from "mysql2/promise";

// Localhost dev fallback only — a non-secret dev password for the docker-mapped
// MySQL on 127.0.0.1:3307. Never used in production: getDbPool() throws if
// DATABASE_URL is missing under NODE_ENV=production so a misconfigured deploy
// can't silently connect with dev credentials.
const DEV_FALLBACK_DATABASE_URL = "mysql://hr_ememo:hr_ememo_dev_password@127.0.0.1:3307/hr_ememo";

let pool: mysql.Pool | null = null;

function resolveDatabaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production but was not set.");
  }
  return DEV_FALLBACK_DATABASE_URL;
}

export function getDbPool() {
  pool ??= mysql.createPool({
    uri: resolveDatabaseUrl(),
    connectionLimit: 5,
    timezone: "Z",
    dateStrings: true,
  });
  return pool;
}
