import { readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

import { formatError, scriptArguments } from "./sonar/arguments";

const repositoryDirectory = fileURLToPath(new URL("../", import.meta.url));
const diagramSuffix = ".diagram.html";
const skippedDirectories = new Set([".git", "node_modules", "dist", ".turbo"]);
const colorSchemes = ["light", "dark"] as const;

function findDiagrams(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name)) {
        found.push(...findDiagrams(path));
      }
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(diagramSuffix)) {
      found.push(path);
    }
  }
  return found.sort();
}

function chooseDiagrams(paths: readonly string[]): string[] {
  if (paths.length === 0) {
    return findDiagrams(repositoryDirectory);
  }
  return paths.map((path) => {
    if (!path.endsWith(diagramSuffix)) {
      throw new Error(`${path} is not a ${diagramSuffix} file`);
    }
    return resolve(path);
  });
}

async function renderDiagrams(paths: readonly string[]): Promise<void> {
  const browser = await chromium.launch();
  try {
    for (const path of paths) {
      const stem = path.slice(0, -diagramSuffix.length);
      for (const colorScheme of colorSchemes) {
        const page = await browser.newPage({
          colorScheme,
          deviceScaleFactor: 2,
          viewport: { width: 1600, height: 1000 },
        });
        const pageErrors: string[] = [];
        page.on("pageerror", (error) => pageErrors.push(error.message));
        await page.goto(pathToFileURL(path).href);
        await page
          .waitForSelector("html[data-diagram-ready]", {
            state: "attached",
            timeout: 15_000,
          })
          .catch((error: unknown) => {
            throw new Error(
              `${relative(repositoryDirectory, path)} never became ready${pageErrors.length > 0 ? `: ${pageErrors.join("; ")}` : ""}`,
              { cause: error },
            );
          });
        const output = `${stem}.${colorScheme}.png`;
        await page.locator(".diagram").first().screenshot({ path: output });
        await page.close();
        console.log(`Rendered ${relative(repositoryDirectory, output)}`);
      }
    }
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  try {
    const diagrams = chooseDiagrams(scriptArguments());
    if (diagrams.length === 0) {
      console.log(`No ${diagramSuffix} files found.`);
    }
    await renderDiagrams(diagrams);
  } catch (error) {
    console.error(`Rendering failed: ${formatError(error)}`);
    process.exitCode = 1;
  }
}

void main();
