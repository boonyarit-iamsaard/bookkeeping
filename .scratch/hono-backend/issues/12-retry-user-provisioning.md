# 12: Retry interrupted fresh-user provisioning

**What to build:** Ensure a user whose auth record committed before default
category initialization failed can safely complete provisioning after signup or
sign-in.

**Blocked by:** 11: Mount Better Auth and authenticated context in Hono

**Status:** ready-for-agent

- [ ] The Better Auth post-create hook invokes the idempotent application initializer after user creation.
- [ ] An authenticated explicit operation retries provisioning without serving as a legacy backfill.
- [ ] Category reads no longer initialize or mutate default categories.
- [ ] A post-commit hook failure leaves a reproducible incomplete state that the retry resolves.
- [ ] Tests cover normal provisioning, hook failure, repeated retry, concurrent retry, and cross-user isolation.
