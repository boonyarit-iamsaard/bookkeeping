import { defineRailway, project, service } from "railway/iac";

// Owns only the api and web services. Naming a partial keeps `plan` and
// `apply` from touching the database and backup services.
export const partial = "apps";

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
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "apps/server/Dockerfile",
      watchPatterns: ["/apps/server/**", ...SHARED_WATCH_PATTERNS],
    },
    deploy: {
      healthcheckPath: "/health",
      restartPolicyType: "ON_FAILURE",
      drainingSeconds: 10,
    },
  });

  const web = service("web", {
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "apps/web/Dockerfile",
      watchPatterns: [
        "/apps/web/**",
        "/apps/server/**",
        ...SHARED_WATCH_PATTERNS,
      ],
    },
    deploy: {
      healthcheckPath: "/",
      restartPolicyType: "ON_FAILURE",
    },
  });

  return project("bookkeeping", { resources: [api, web] });
});
