import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { problemForStatus, problemResponse } from "./problem-details.js";
import type { AppEnv } from "./request-context.js";

function unexpectedFaultResponse(error: unknown, c: Context<AppEnv>): Response {
  console.error("Unhandled request error", {
    error,
    requestId: c.get("requestId"),
  });

  return problemResponse(c, problemForStatus(500));
}

export function handleRequestError(error: Error, c: Context<AppEnv>): Response {
  if (error instanceof HTTPException) {
    return problemResponse(c, problemForStatus(error.status));
  }

  return unexpectedFaultResponse(error, c);
}

export async function errorBoundaryMiddleware(
  c: Context<AppEnv>,
  next: Next,
): Promise<Response | undefined> {
  try {
    await next();
  } catch (error: unknown) {
    return unexpectedFaultResponse(error, c);
  }
}
