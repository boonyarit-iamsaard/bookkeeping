# Bookkeeping

A phone-first bookkeeping application: a Vite and TanStack Router single-page
client installable as a PWA, calling a Hono API on Node.js, with TypeScript,
PostgreSQL, and Drizzle ORM. Email and password authentication uses Better
Auth, mounted in the API. Shared UI uses Tailwind CSS and shadcn components
with Base UI.

The domain vocabulary is in [CONTEXT.md](CONTEXT.md), and the decisions behind
the design are in [docs/adr/](docs/adr/).

## Development

- [Setup](docs/development/setup.md): local setup, environment configuration,
  database commands, and production containers
- [Workflow](docs/development/workflow.md): Git workflow, checks, and
  dependency updates
- [Architecture](docs/development/architecture.md): project structure and
  package ownership
- [Testing](docs/development/testing.md): unit, integration, and browser
  tests, and local SonarQube
- [Operations](docs/development/operations.md): production hosting, backups,
  and recovering a locked-out Account
- [Diagrams](docs/development/diagrams.md): the diagram kit
- [Code conventions](docs/code-conventions.md): naming, vocabulary ownership,
  and house-style enforcement
