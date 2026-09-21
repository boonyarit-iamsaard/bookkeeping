import createClient from "openapi-fetch";
import { clientConfig } from "@/core/env/config";
import type { paths } from "./openapi.gen";

function createApiClient(apiOrigin: string) {
  // The session cookie is host-only on the API origin; every request carries it.
  return createClient<paths>({ baseUrl: apiOrigin, credentials: "include" });
}

export const apiClient = createApiClient(clientConfig.apiOrigin);

export type ApiClient = typeof apiClient;
