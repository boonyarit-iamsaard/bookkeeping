import { defineRailway, github, preserve, project, service } from "railway/iac";

// Owns only the api and web services. Naming a partial keeps `plan` and
// `apply` from touching the database and backup services.
export const partial = "apps";

// Variable values and secrets stay in the Railway dashboard. `preserve()`
// names each variable so `apply` leaves its value alone, and `plan` fails when
// a dashboard variable is missing from the list.

// Restart policy is "On Failure" in the dashboard and is not declared here:
// `apply` does not persist `restartPolicyType`, so `plan` would report it as
// pending for ever.

const REPOSITORY = "boonyarit-iamsaard/bookkeeping";

// What the services run with today. Declared so `apply` leaves the limits alone.
const CONTAINER_LIMITS = { cpu: 1, memoryBytes: 1_000_000_000 };

const SHARED_WATCH_PATTERNS = [
  "/packages/**",
  "/package.json",
  "/pnpm-lock.yaml",
  "/pnpm-workspace.yaml",
  "/.pnpmfile.cjs",
  "/tsconfig.base.json",
  "/.dockerignore",
];

export default defineRailway(() => {
  const api = service("api", {
    // `checkSuites` is "Wait for CI".
    source: github(REPOSITORY, { checkSuites: true }),
    env: {
      AUTH_RATE_LIMIT_ENABLED: preserve(),
      AUTH_SIGN_UP_ENABLED: preserve(),
      BETTER_AUTH_SECRET: preserve(),
      BETTER_AUTH_URL: preserve(),
      CLIENT_ORIGINS: preserve(),
      DATABASE_URL: preserve(),
    },
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "/apps/server/Dockerfile",
      watchPatterns: ["/apps/server/**", ...SHARED_WATCH_PATTERNS],
    },
    deploy: {
      // Applies pending migrations before the new image takes traffic; a
      // failure stops the deploy and the old version keeps serving.
      preDeployCommand: ["node dist/migrate.js"],
      healthcheckPath: "/health",
      drainingSeconds: 10,
      limitOverride: { containers: CONTAINER_LIMITS },
    },
  });

  const web = service("web", {
    source: github(REPOSITORY, { checkSuites: true }),
    env: {
      VITE_API_ORIGIN: preserve(),
    },
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "/apps/web/Dockerfile",
      watchPatterns: [
        "/apps/web/**",
        "/apps/server/**",
        ...SHARED_WATCH_PATTERNS,
      ],
    },
    deploy: {
      healthcheckPath: "/",
      limitOverride: { containers: CONTAINER_LIMITS },
    },
  });

  return project("bookkeeping", { resources: [api, web] });
});
