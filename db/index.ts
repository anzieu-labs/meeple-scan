import "server-only";

import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

// TCP pool: Fluid Compute reuses warm instances, so connections are kept between requests.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  idleTimeoutMillis: 5_000,
});
attachDatabasePool(pool);

export const db = drizzle({ client: pool, schema, casing: "snake_case" });
