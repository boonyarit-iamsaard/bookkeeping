import "server-only";

import { resolveSession } from "@bookkeeping/auth/session";
import { headers } from "next/headers";
import { auth } from "@/core/auth/config";

export async function getSession() {
  return resolveSession(auth, await headers());
}
