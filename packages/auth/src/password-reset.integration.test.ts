import { accounts } from "@bookkeeping/database/auth";
import type { Database } from "@bookkeeping/database/connection";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import type { Auth } from "./config";
import { createAuth } from "./config";
import { resetPassword } from "./password-reset";
import { resolveSession } from "./session";
import { TEST_BASE_URL, TEST_SECRET, uniqueEmail } from "./testing/test-auth";

const { withRollback } = setupTestDatabase();

const OLD_PASSWORD = "correct horse battery";
const NEW_PASSWORD = "staple tongue ladder";

async function signUp(db: Database, email: string) {
  const auth = createAuth({ db, secret: TEST_SECRET, baseURL: TEST_BASE_URL });
  const { headers } = await auth.api.signUpEmail({
    body: { name: "Locked-out user", email, password: OLD_PASSWORD },
    returnHeaders: true,
  });
  const cookie = new Headers({ cookie: headers.get("set-cookie") ?? "" });
  return { auth, cookie };
}

interface Credentials {
  email: string;
  password: string;
}

async function signsIn(auth: Auth, credentials: Readonly<Credentials>) {
  try {
    await auth.api.signInEmail({ body: { ...credentials } });
    return true;
  } catch {
    return false;
  }
}

async function minPasswordLength(auth: Auth) {
  return (await auth.$context).password.config.minPasswordLength;
}

async function maxPasswordLength(auth: Auth) {
  return (await auth.$context).password.config.maxPasswordLength;
}

describe("resetPassword", () => {
  test("the new password signs in and the old one no longer does", async () => {
    await withRollback(async (db) => {
      const email = uniqueEmail("reset");
      const { auth } = await signUp(db, email);

      const result = await resetPassword({
        auth,
        db,
        email,
        password: NEW_PASSWORD,
      });

      expect(result).toEqual({ ok: true, value: undefined });
      expect(await signsIn(auth, { email, password: NEW_PASSWORD })).toBe(true);
      expect(await signsIn(auth, { email, password: OLD_PASSWORD })).toBe(
        false,
      );
    });
  });

  test("a reset ends every session the Account already held", async () => {
    await withRollback(async (db) => {
      const email = uniqueEmail("revoke");
      const { auth, cookie } = await signUp(db, email);
      expect(await resolveSession(auth, cookie)).not.toBeNull();

      await resetPassword({ auth, db, email, password: NEW_PASSWORD });

      expect(await resolveSession(auth, cookie)).toBeNull();
    });
  });

  test("an email no Account uses is refused", async () => {
    await withRollback(async (db) => {
      const auth = createAuth({
        db,
        secret: TEST_SECRET,
        baseURL: TEST_BASE_URL,
      });

      const result = await resetPassword({
        auth,
        db,
        email: uniqueEmail("nobody"),
        password: NEW_PASSWORD,
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "account-not-found" },
      });
    });
  });

  test("an Account without a password is refused and keeps its sessions", async () => {
    await withRollback(async (db) => {
      const { auth, cookie } = await signUp(db, uniqueEmail("passwordless"));
      const session = await resolveSession(auth, cookie);
      if (!session) {
        throw new Error("Sign-up did not issue a session");
      }
      await db.delete(accounts).where(eq(accounts.userId, session.user.id));

      const result = await resetPassword({
        auth,
        db,
        email: session.user.email,
        password: NEW_PASSWORD,
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "account-not-found" },
      });
      expect(await resolveSession(auth, cookie)).not.toBeNull();
    });
  });

  test("a password shorter than sign-in accepts is refused and changes nothing", async () => {
    await withRollback(async (db) => {
      const email = uniqueEmail("short");
      const { auth } = await signUp(db, email);

      const result = await resetPassword({
        auth,
        db,
        email,
        password: "x".repeat((await minPasswordLength(auth)) - 1),
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "password-too-short" },
      });
      expect(await signsIn(auth, { email, password: OLD_PASSWORD })).toBe(true);
    });
  });

  test("a password longer than sign-in accepts is refused", async () => {
    await withRollback(async (db) => {
      const email = uniqueEmail("long");
      const { auth } = await signUp(db, email);

      const result = await resetPassword({
        auth,
        db,
        email,
        password: "x".repeat((await maxPasswordLength(auth)) + 1),
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "password-too-long" },
      });
    });
  });

  test("the email finds its Account whatever its case", async () => {
    await withRollback(async (db) => {
      const email = uniqueEmail("case");
      const { auth } = await signUp(db, email);

      const result = await resetPassword({
        auth,
        db,
        email: email.toUpperCase(),
        password: NEW_PASSWORD,
      });

      expect(result).toEqual({ ok: true, value: undefined });
      expect(await signsIn(auth, { email, password: NEW_PASSWORD })).toBe(true);
    });
  });
});
