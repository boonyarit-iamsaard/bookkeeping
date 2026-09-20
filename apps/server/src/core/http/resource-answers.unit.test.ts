import { err, ok } from "@bookkeeping/domain/result";
import { Hono } from "hono";
import { describe, expect, test } from "vitest";
import { PROBLEM_MEDIA_TYPE, problemDetailsSchema } from "./problem-details.js";
import {
  answerCorrection,
  answerCreation,
  answerRead,
  answerRemoval,
  NOT_FOUND,
} from "./resource-answers.js";

type Rejection = { code: "blank-name" } | { code: "idempotency-conflict" };
type CorrectionError = { code: "not-found" } | { code: "blank-name" };
type RemovalError = { code: "not-found" } | { code: "in-use" };

const created = { id: "0199", name: "Cash" };

function app() {
  return new Hono()
    .post("/wallets", (c) => {
      const outcome = c.req.query("outcome");
      const result =
        outcome === "conflict"
          ? err<Rejection>({ code: "idempotency-conflict" })
          : outcome === "rejected"
            ? err<Rejection>({ code: "blank-name" })
            : ok({ wallet: created });
      return answerCreation(c, {
        result,
        present: (value: { wallet: typeof created }) => value.wallet,
        toFieldErrors: () => [{ pointer: "#/name", code: "blank-name" }],
      });
    })
    .get("/wallets/:id", (c) =>
      answerRead(c, {
        value: c.req.param("id") === created.id ? created : null,
        present: (wallet) => ({ ...wallet, presented: true }),
      }),
    )
    .put("/wallets/:id", (c) => {
      const result =
        c.req.param("id") === created.id
          ? c.req.query("outcome") === "rejected"
            ? err<CorrectionError>({ code: "blank-name" })
            : ok(created)
          : err<CorrectionError>({ code: "not-found" });
      return answerCorrection(c, {
        result,
        present: (wallet) => wallet,
        toFieldErrors: (error) =>
          error.code === "not-found"
            ? NOT_FOUND
            : [{ pointer: "#/name", code: error.code }],
      });
    })
    .delete("/wallets/:id", (c) => {
      const result =
        c.req.param("id") === created.id
          ? c.req.query("outcome") === "blocked"
            ? err<RemovalError>({ code: "in-use" })
            : ok({ id: created.id })
          : err<RemovalError>({ code: "not-found" });
      return answerRemoval(c, {
        result,
        toBlockerProblem: (error) =>
          error.code === "not-found"
            ? NOT_FOUND
            : { code: "in-use", status: 409, title: "In use" },
      });
    });
}

async function problemOf(response: Response) {
  expect(response.headers.get("content-type")).toContain(PROBLEM_MEDIA_TYPE);
  return problemDetailsSchema.parse(await response.json());
}

describe("resource answers", () => {
  test("a creation answers 201 under the served collection path, or its conflict and rejection", async () => {
    const createdResponse = await app().request("/wallets", { method: "POST" });
    expect(createdResponse.status).toBe(201);
    expect(createdResponse.headers.get("location")).toBe("/wallets/0199");
    expect(await createdResponse.json()).toEqual(created);

    const conflict = await problemOf(
      await app().request("/wallets?outcome=conflict", { method: "POST" }),
    );
    expect(conflict).toMatchObject({
      status: 409,
      code: "idempotency-conflict",
    });

    const rejected = await problemOf(
      await app().request("/wallets?outcome=rejected", { method: "POST" }),
    );
    expect(rejected).toMatchObject({
      status: 422,
      code: "invalid-command",
      errors: [{ pointer: "#/name", code: "blank-name" }],
    });
  });

  test("a read presents the value or answers not found", async () => {
    const found = await app().request("/wallets/0199");
    expect(found.status).toBe(200);
    expect(await found.json()).toEqual({ ...created, presented: true });

    expect(await problemOf(await app().request("/wallets/0000"))).toMatchObject(
      { status: 404, code: "not-found" },
    );
  });

  test("a correction answers the corrected resource, not found, or field errors", async () => {
    const corrected = await app().request("/wallets/0199", { method: "PUT" });
    expect(corrected.status).toBe(200);
    expect(await corrected.json()).toEqual(created);

    expect(
      await problemOf(await app().request("/wallets/0000", { method: "PUT" })),
    ).toMatchObject({ status: 404 });
    expect(
      await problemOf(
        await app().request("/wallets/0199?outcome=rejected", {
          method: "PUT",
        }),
      ),
    ).toMatchObject({
      status: 422,
      errors: [{ pointer: "#/name", code: "blank-name" }],
    });
  });

  test("a removal answers an empty 204, not found, or the named blocker", async () => {
    const removed = await app().request("/wallets/0199", { method: "DELETE" });
    expect(removed.status).toBe(204);
    expect(await removed.text()).toBe("");

    expect(
      await problemOf(
        await app().request("/wallets/0000", { method: "DELETE" }),
      ),
    ).toMatchObject({ status: 404 });
    expect(
      await problemOf(
        await app().request("/wallets/0199?outcome=blocked", {
          method: "DELETE",
        }),
      ),
    ).toMatchObject({ status: 409, code: "in-use" });
  });
});
