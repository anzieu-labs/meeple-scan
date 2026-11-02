import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  // Migrations go through the direct (unpooled) connection when one is provided.
  dbCredentials: { url: (process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL)! },
});
