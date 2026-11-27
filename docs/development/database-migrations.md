# Database migrations

Schema changes are recorded as forward-only Drizzle migrations in the
`packages/database/drizzle/` folder. Generate every migration with an explicit
snake_case name, for example:

```sh
pnpm --filter @bookkeeping/database exec drizzle-kit generate --name add_wallet_currency
```

The default four-digit `index` prefix is retained. For one-table changes, use
Laravel-style slugs:

- `create_<table>_table`, such as `create_wallets_table`
- `add_<column>_to_<table>_table`, such as `add_archived_at_to_wallets_table`
- `drop_<column>_from_<table>_table`, such as `drop_image_from_users_table`
- `alter_<table>_table_<change>`, such as `alter_wallets_table_add_currency_check`

For a change spanning several tables, use a snake_case intent slug instead,
such as `add_transaction_history`. Keep one intent per migration; generate
unrelated changes separately. Never commit Drizzle's random names such as
`wild_hulk`.

CI enforces schema drift and the migration file-name shape mechanically; the
meaning of a slug remains a review concern.

If `generate` asks whether a change is a rename, stop without answering the
prompt and give the owner this exact command to run on the host after reviewing
the rename:

```sh
pnpm --filter @bookkeeping/database exec drizzle-kit generate --name <snake_case_name>
```

Production applies migrations in Railway's pre-deploy step (ADR 0014), so the
committed history is immutable: fix a wrong migration with a newer one. CI
fails a PR that changes or deletes a migration file on `main`; the journal may
only gain entries.

Every migration works with the release it replaces, because the old version
keeps serving when the new deploy fails. Expand first: add columns, tables and
constraints the old code tolerates. Drop or rename only in a later release,
once no deployed code reads the old shape. Review checks this; CI does not.

Before merging a PR that adds a migration, the owner runs the `backup` service
by hand outside 20:00–20:59 UTC and confirms `uploaded to manual/…`. The
owner's merge authorizes applying the migration.

`db:push` is only for experiments on a throwaway database; generate the
migration before committing the resulting schema.
`db:fresh` drops the `public` and `drizzle` schemas, recreates `public`, and
reapplies every committed migration. It is destructive and only works when
`DATABASE_URL` points to `localhost`, `127.0.0.1` or `::1`, judged by the host
`pg` connects to, so a `?host=` query parameter counts; it has no override for
a remote database. A loopback URL can still be a tunnel to production, so before
dropping anything it also refuses a database holding an Account other than
`demo@bookkeeping.localhost`; `--allow-other-accounts` overrides that check.
`db:fresh --seed` then fills the rebuilt database with the sample ledger.
