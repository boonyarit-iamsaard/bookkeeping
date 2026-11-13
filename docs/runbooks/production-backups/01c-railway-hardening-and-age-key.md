# Runbook: Railway hardening and the replacement age key

- **Source:** [#219](https://github.com/boonyarit-iamsaard/bookkeeping/issues/219)
- **Docs checked:** 2026-10-18
- **Estimated time:** 90 minutes for all three parts · **Estimated cost:** on
  Railway, a few cents a month for backup storage at the volume's per-GB rate:
  the database is 8.7 MB and backups are incremental.

Part 3 of 3. Step numbers run across the parts: steps 1 to 6 are in
`01a-aws-organization-and-root.md`, steps 7 to 13 are in
`01b-identity-center-and-cli.md`, and steps 14 to 16 are here. These steps
don't depend on the AWS ones.

Every identifier below is a placeholder. Substitute the real value on screen;
never write it into this file. The repository is public.

## Prerequisites

- [x] `age` 1.x. Already installed here (`age --version` prints `v1.3.2`).

  ```sh
  # 1.3.2
  ```

- [x] Optional: the Railway CLI, used only for read-only checks in steps
      14 and 15. Without it, you report what the dashboard shows instead.

  ```sh
  npm i -g @railway/cli
  railway login
  # 5.70.0
  # Signed in as <OWNER_NAME> (<OWNER_EMAIL>)
  ```

  Source: <https://docs.railway.com/cli>

- [x] The burned `age` key file `<OLD_KEY_FILE>` and the manual dump encrypted
      with it, `<OLD_DUMP_FILE>`, both from 2026-10-17.
- [x] A password manager entry and an offline medium (USB stick or paper) for
      the new `age` key.
- Railway project: production, service `database`.

## Decisions

| Fork                           | Choice                                             | Why                                                                                                                             |
| ------------------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Railway point-in-time recovery | Leave PITR off                                     | It is out of scope in the spec, and it creates a bucket and redeploys Postgres.                                                 |
| Railway CLI                    | Optional; recommended                              | It lets the agent check the proxy, schedules and variable names without screenshots. Every check also works from the dashboard. |
| Fate of the old dump and key   | Delete both once the re-encrypted dump is verified | The old private key was shown in a screenshot, so a copy of the old ciphertext is readable by anyone who saw it.                |

## Steps

### 14. Turn on Railway's own backups for Postgres

- [ ] **Skipped:** needs Railway Pro; see the Run log.
- **Goal:** Daily, weekly and monthly backup schedules on the `database`
  service, plus one manual backup.
- **Why:** These are the fastest restore path for everyday mistakes. They don't
  satisfy ADR 0008: a backup kept in the same account is deleted when the
  volume is wiped.
- **Where:** Railway dashboard → production project → `database` service →
  **Backups** tab (per docs, verify on screen).
- **Do:**
  1. Select all three schedules: **Daily**, **Weekly** and **Monthly**.
  2. Create a manual backup from the same tab. Manual backups are limited to
     50% of the volume's size, which is far above 8.7 MB.
  3. Do not choose **Enable PITR**.
- **Expect:** The tab lists the three schedules and one backup with today's
  date stamp. Retention is 6 days for daily, 27 for weekly and 89 for
  monthly; the Postgres guide rounds these to 1 and 3 months.
- **Verify:** With the Railway CLI, I run, read-only:

  ```sh
  railway postgres pitr schedule list --service database --environment production
  railway postgres pitr backup list --service database --environment production
  ```

  Without it, tell me what the Backups tab shows.

- **Undo:** Deselect the schedules. A manual backup can be deleted from the
  same tab.
- **Ticks:** "Railway Postgres service, Backups tab: daily, weekly and monthly
  schedules enabled; one manual backup taken."
- **Source:** <https://docs.railway.com/volumes/backups>,
  <https://docs.railway.com/guides/postgres-backups-restores>,
  <https://docs.railway.com/cli/postgres>

### 15. Confirm the TCP proxy is gone

- [x] **Done**
- **Goal:** `database` has no TCP proxy, and no `DATABASE_PUBLIC_URL`
  variable.
- **Why:** The proxy exposed the database to the internet for the 2026-10-17
  dump. The spec keeps the database on the private network. The build log says
  the proxy was closed; this step proves it.
- **Where:** Railway dashboard → `database` → **Settings** → **Networking**,
  then **Variables** (per docs, verify on screen).
- **Do:**
  1. If a TCP proxy is listed, delete it with its trash icon.
  2. Open **Variables** and check `DATABASE_PUBLIC_URL` is not listed. The
     docs say Railway fills that variable when public access creates a TCP
     proxy. They don't say that deleting the proxy removes it, so delete it by
     hand if it is still listed.
  3. Check that no other service references `database.DATABASE_PUBLIC_URL`.
     The api should reference `${{database.DATABASE_URL}}` only.
- **Expect:** No TCP proxy under Networking, and no `DATABASE_PUBLIC_URL`.
- **Verify:** With the Railway CLI, I run read-only commands that print names,
  never values:

  ```sh
  railway tcp-proxy list --service database --environment production
  railway variable list --service database --environment production -k | cut -d= -f1
  ```

  The first should list nothing, and the second should not include
  `DATABASE_PUBLIC_URL`. Without the CLI, tell me what both dashboard pages
  show.

- **Undo:** A TCP proxy can be added again under **Networking**. Don't, unless
  a later ticket needs one.
- **Ticks:** "The Railway TCP proxy used for the 2026-10-17 manual dump is
  disabled and `DATABASE_PUBLIC_URL` is gone."
- **Source:** <https://docs.railway.com/databases/postgresql>,
  <https://docs.railway.com/cli/tcp-proxy>,
  <https://docs.railway.com/cli/variable>,
  <https://docs.railway.com/networking/domains/working-with-domains>

### 16. Replace the exposed `age` key and re-encrypt the dump

- [x] **Done**
- **Goal:** A new `age` key pair, the 2026-10-17 dump encrypted with it, the
  new private key in two places, and the burned key and old ciphertext deleted.
- **Why:** The old private key appeared in a screenshot. Ticket 04's job must
  use the replacement, and losing the new key makes every backup unreadable.
- **Where:** Your terminal, not through me: the private key must never reach
  this session.
- **Do:**
  1. Generate the key with owner-only permissions. `age-keygen` prints the
     public key and nothing else; never `cat` the key file.

     ```sh
     (umask 077 && age-keygen -o <NEW_KEY_FILE>)
     age-keygen -y <NEW_KEY_FILE>   # the public key, age1…, safe to share
     ```

  2. Re-encrypt in a single pipe, so the plaintext never touches disk.
     `pipefail` makes a failed decrypt fail the whole pipe. Stop if `ok`
     doesn't print:

     ```sh
     set -o pipefail
     age -d -i <OLD_KEY_FILE> <OLD_DUMP_FILE> \
       | age -r <NEW_AGE_PUBLIC_KEY> -o <NEW_DUMP_FILE> && echo ok
     ```

  3. Check the two files decrypt to identical bytes. Each line must print
     `ok`, and the hash must not be `e3b0c442…`, the hash of empty input:

     ```sh
     set -o pipefail
     age -d -i <OLD_KEY_FILE> <OLD_DUMP_FILE> | sha256sum && echo ok
     age -d -i <NEW_KEY_FILE> <NEW_DUMP_FILE> | sha256sum && echo ok
     ```

  4. Store the contents of `<NEW_KEY_FILE>` in your password manager and on an
     offline medium. Test both copies: decrypt `<NEW_DUMP_FILE>` with each, and
     compare the hash with step 3.
  5. Only after steps 3 and 4 pass, delete `<OLD_DUMP_FILE>` and every copy of
     `<OLD_KEY_FILE>`, including any in your password manager.
  6. Note the new public key somewhere handy. Ticket 03 puts it in Railway as
     `AGE_RECIPIENT`.
- **Expect:** Both hashes match. Two tested copies of the new key exist, and no
  copy of the old key.
- **Verify:** Tell me the two hashes match (the hash itself is not secret, so
  you can paste it), and that both stored copies decrypted the file. I check
  the new ciphertext's header, without needing a key:

  ```sh
  head -c 64 <NEW_DUMP_FILE> | head -n 2
  ```

  It should start `age-encryption.org/v1` with one `-> X25519` stanza.

- **Undo:** ⚠️ Irreversible: once the old key is deleted, the old ciphertext
  cannot be decrypted, which is the point. Don't do step 5 until step 4 has
  passed on both copies.
- **Ticks:** "The exposed `age` key from 2026-10-17 is replaced, the manual
  dump re-encrypted with the new key, and the new key stored in two places."
- **Source:** <https://github.com/FiloSottile/age/blob/main/README.md>

## Run log

### 2026-10-18

- Open point from the research: Railway's docs don't say that deleting the TCP proxy removes
  `DATABASE_PUBLIC_URL`, or name the manual-backup button (steps 14 and 15).
- Completed: step 16. New key at `<NEW_KEY_FILE>` (mode 600). The dump was
  re-encrypted to `<NEW_DUMP_FILE>`; its header has one `-> X25519` stanza.
  The old and new ciphertexts decrypt to the same SHA-256. Both stored copies
  decrypted the dump to that hash. The old key, the old dump and the
  screenshot were then deleted.
- Deviation: the second copy is not on an offline medium. It is a
  passphrase-encrypted copy of the key file (`age -p`, `-> scrypt` stanza) in
  the owner's cloud drive, usable directly with `age -d -i`. The passphrase is
  kept outside the password manager, so the two copies don't share a point of
  failure. The first copy is a password-manager note, tested by piping the
  clipboard into `age -d -i -`.
- Skipped: step 14. The `database` service's **Backups** tab says the
  current plan can only view, restore and delete backups; creating backups,
  schedules and PITR need Pro. The owner chose to stay on Hobby and drop
  Railway's own backups. The off-Railway job (tickets 02 to 06) is what ADR
  0008 requires. Until ticket 04 ships, the re-encrypted 2026-10-17 dump is
  the only copy of the data outside the volume.
- Deviation: the Postgres service is named `database`, not `Postgres`; steps
  14 and 15 are corrected.
- Completed: step 15, from the CLI after `railway link` (names and counts
  only). `railway tcp-proxy list` finds no TCP proxies on `database`. Its
  variables include `DATABASE_URL` and no `DATABASE_PUBLIC_URL` or
  `RAILWAY_TCP_PROXY_*`. No `api` variable value points at a
  `proxy.rlwy.net` host or `DATABASE_PUBLIC_URL`. Nothing needed deleting.
