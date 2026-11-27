import { neon } from "@neondatabase/serverless";
import postgres from "postgres";

// Reuse one Hyperdrive client per Worker isolate instead of creating a new
// connection pool for every request. Production continues to use Neon HTTP.
let hyperdriveConnectionString = "";
let hyperdriveSql = null;

export function getSql(env) {
  const connectionString = env.HYPERDRIVE?.connectionString;
  if (connectionString) {
    if (!hyperdriveSql || hyperdriveConnectionString !== connectionString) {
      hyperdriveConnectionString = connectionString;
      const client = postgres(connectionString, {
        max: 5,
        idle_timeout: 20,
        connect_timeout: 10,
        prepare: false,
        fetch_types: false,
      });
      const sql = (...args) => client(...args);
      // Keep compatibility with the existing parameterized-query call sites.
      sql.query = (query, params = []) => client.unsafe(query, params);
      hyperdriveSql = sql;
    }
    return hyperdriveSql;
  }

  if (env.DATABASE_URL) return neon(env.DATABASE_URL);
  throw new Error("Database connection is not configured");
}
