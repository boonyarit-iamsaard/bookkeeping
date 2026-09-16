import { inject } from "vitest";

declare module "vitest" {
  export interface ProvidedContext {
    testDatabaseUrl: string;
  }
}

export function testDatabaseUrl(): string {
  return inject("testDatabaseUrl");
}
