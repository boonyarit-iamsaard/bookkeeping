import { initializeDefaultCategories } from "@bookkeeping/application/categories";
import type { Database } from "@bookkeeping/database/connection";
import type { Hono } from "hono";
import type { AppEnv } from "../core/http/request-context.js";
import { categoryCollectionResponseSchema } from "../features/categories/category.routes.js";
import { TEST_API_ORIGIN } from "./create-integration-test-app.js";
import { createOwnerSession } from "./create-test-auth-gateway.js";
import { TEST_CLIENT_ORIGIN } from "./create-unit-test-app.js";

export const CATEGORIES_URL = `${TEST_API_ORIGIN}/v1/categories`;

/**
 * A fresh owner with the complete default category trees, the way sign-up's
 * provisioning hook leaves one.
 */
export async function createProvisionedOwner(db: Database): Promise<{
  cookie: string;
  ownerId: string;
}> {
  const { cookie, ownerId } = await createOwnerSession(db);
  await initializeDefaultCategories(db, ownerId);
  return { cookie, ownerId };
}

export function listCategories(app: Readonly<Hono<AppEnv>>, cookie?: string) {
  return app.request(CATEGORIES_URL, {
    headers: {
      origin: TEST_CLIENT_ORIGIN,
      ...(cookie ? { cookie } : {}),
    },
  });
}

export interface ListedCategoryRequest {
  name: string;
  cookie: string;
}

/** The owner's category of that name, as the collection lists it. */
export async function findListedCategory(
  app: Readonly<Hono<AppEnv>>,
  { name, cookie }: Readonly<ListedCategoryRequest>,
) {
  const collection = categoryCollectionResponseSchema.parse(
    await (await listCategories(app, cookie)).json(),
  );
  const category = collection.items.find((item) => item.name === name);
  if (!category) {
    throw new Error(`Expected the ${name} category`);
  }
  return category;
}
