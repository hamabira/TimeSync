import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb(env: any) {
  // env.DB は Cloudflare D1 のバインディング
  return drizzle(env.DB, { schema });
}
