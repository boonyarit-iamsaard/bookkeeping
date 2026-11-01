# Operations

Production runs on Railway ([ADR 0008](../adr/0008-railway-single-hosting-provider.md)),
deploys every merge to `main`, which accepts only pull requests that pass the
[required checks](workflow.md#git-workflow)
([ADR 0010](../adr/0010-protected-main-and-gated-deploys.md)), and applies
committed migrations in the API's pre-deploy step
([ADR 0014](../adr/0014-production-migrations-in-railway-pre-deploy.md)).
Nightly encrypted backups go to AWS S3
([ADR 0013](../adr/0013-nightly-encrypted-backups-to-aws-s3.md)); the
[backup README](../../apps/backup/README.md) covers the job and the restore
drill.

## Recovering a locked-out Account

The app has no emailed password reset. The owner sets a new password with a
script that runs where the server runs, with the server environment. It asks
for the password twice without echoing it, refuses one that sign-in would
reject, and ends every session the Account held, so every device signs in
again.

Locally, with `apps/server/.env` in place:

```sh
pnpm password:reset owner@example.com
```

In production, open a shell in the deployed API container, whose environment
already holds the server variables, and run the compiled script there:

```sh
railway ssh --service <api-service>
node --enable-source-maps dist/reset-password-cli.js owner@example.com
```

The script needs an interactive terminal and refuses piped input, so a
password never passes through shell history or logs.
