import { createAuth } from "@bookkeeping/auth/config";
import type { ResetPasswordError } from "@bookkeeping/auth/password-reset";
import { resetPassword } from "@bookkeeping/auth/password-reset";
import { createDatabase } from "@bookkeeping/database/connection";
import { parseServerEnv } from "./core/env/config.js";

// The owner's lockout recovery; the app has no emailed reset flow. Run it
// where the server runs, with the server's environment:
//   node dist/reset-password-cli.js <email>

const RESET_PASSWORD_MESSAGES: Record<ResetPasswordError["code"], string> = {
  "account-not-found": "No Account with a password uses that email.",
  "password-too-short": "That password is shorter than sign-in accepts.",
  "password-too-long": "That password is longer than sign-in accepts.",
};

// Raw-mode key input. Windows consoles send Backspace as BS, POSIX terminals
// (including WSL) as DEL; Enter arrives as CR, or LF when piped in by a pty.
const CANCEL_KEYS = new Set(["\u0003", "\u0004"]); // Ctrl+C, Ctrl+D
const ENTER_KEYS = new Set(["\r", "\n"]);
const BACKSPACE_KEYS = new Set(["\b", "\u007f"]);
const ESCAPE = "\u001b";

class PromptCancelledError extends Error {}

/**
 * Applies one raw-mode chunk to the answer typed so far. Returns the updated
 * answer and whether Enter or a cancel key ended the line.
 */
function applyKeys(answer: string, chunk: string) {
  // Arrow and function keys arrive as escape sequences; none belong in a
  // password.
  if (chunk.startsWith(ESCAPE)) {
    return { answer, ended: undefined };
  }
  let typed = answer;
  for (const character of chunk) {
    if (CANCEL_KEYS.has(character)) {
      return { answer: typed, ended: "cancel" as const };
    }
    if (ENTER_KEYS.has(character)) {
      return { answer: typed, ended: "enter" as const };
    }
    if (BACKSPACE_KEYS.has(character)) {
      // Drop the last code point, not the last UTF-16 unit, so an emoji
      // deletes whole.
      typed = Array.from(typed).slice(0, -1).join("");
    } else if (character >= " ") {
      typed += character;
    }
  }
  return { answer: typed, ended: undefined };
}

/** Reads one line from the terminal without echoing what is typed. */
function promptHidden(question: string): Promise<string> {
  const { stdin, stdout } = process;
  stdout.write(question);
  stdin.setRawMode(true);
  stdin.setEncoding("utf8");
  stdin.resume();
  return new Promise((resolve, reject) => {
    let answer = "";
    function handleData(chunk: string) {
      const applied = applyKeys(answer, chunk);
      answer = applied.answer;
      if (applied.ended === undefined) {
        return;
      }
      stdin.off("data", handleData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
      if (applied.ended === "cancel") {
        reject(new PromptCancelledError());
      } else {
        resolve(answer);
      }
    }
    stdin.on("data", handleData);
  });
}

async function main(): Promise<number> {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: reset-password-cli <email>");
    return 1;
  }
  if (!process.stdin.isTTY) {
    console.error("Run this from an interactive terminal.");
    return 1;
  }
  // Fail on a missing variable before asking for anything.
  const config = parseServerEnv(process.env);

  const password = await promptHidden("New password: ");
  if ((await promptHidden("Repeat it: ")) !== password) {
    console.error("The passwords did not match.");
    return 1;
  }

  const { db, close } = createDatabase(config.databaseUrl);
  try {
    const auth = createAuth({
      db,
      secret: config.authSecret,
      baseURL: config.authBaseUrl,
    });
    const result = await resetPassword({ auth, db, email, password });
    if (!result.ok) {
      console.error(RESET_PASSWORD_MESSAGES[result.error.code]);
      return 1;
    }
    console.log("Password reset; every session for that Account has ended.");
    return 0;
  } finally {
    await close();
  }
}

try {
  process.exitCode = await main();
} catch (error: unknown) {
  if (error instanceof PromptCancelledError) {
    console.error("Cancelled; nothing changed.");
  } else {
    console.error(error);
  }
  process.exitCode = 1;
}
