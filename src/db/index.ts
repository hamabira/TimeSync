import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type CloudflareDbEnv = {
  DB: D1Database;
};

export function getDb(env: unknown) {
  // env.DB は Cloudflare D1 のバインディング
  return drizzle((env as CloudflareDbEnv).DB, { schema });
}
