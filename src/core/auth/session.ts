import "server-only";

import { headers } from "next/headers";
import { auth } from "@/core/auth/config";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}
