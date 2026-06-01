import mysql from "mysql2/promise";

const DEFAULT_DATABASE_URL = "mysql://hr_ememo:hr_ememo_dev_password@127.0.0.1:3307/hr_ememo";

let pool: mysql.Pool | null = null;

export function getDbPool() {
  pool ??= mysql.createPool({
    uri: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
    connectionLimit: 5,
    timezone: "Z",
    dateStrings: true,
  });
  return pool;
}
