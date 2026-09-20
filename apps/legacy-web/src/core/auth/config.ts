import { createAuth } from "@bookkeeping/auth/config";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/core/database/client";
import { env } from "@/core/env/config";

// The Next.js mount only injects its environment and framework plugin; the
// shared configuration lives in @bookkeeping/auth.
export const auth = createAuth({
  db,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  // Lets server actions set the session cookie.
  plugins: [nextCookies()],
});
