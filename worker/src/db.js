import { neon } from "@neondatabase/serverless";
import postgres from "postgres";

// Preview Workers connect through Cloudflare Hyperdrive. Production keeps using
// the existing Neon HTTP URL secret unless a Hyperdrive binding is configured.
export function getSql(env) {
  const connectionString = env.HYPERDRIVE?.connectionString;
  if (connectionString) {
    const client = postgres(connectionString, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      fetch_types: false,
    });
    const sql = (...args) => client(...args);
    sql.query = (query, params = []) => client.unsafe(query, params);
    return sql;
  }

  if (env.DATABASE_URL) return neon(env.DATABASE_URL);
  throw new Error("Database connection is not configured");
}
