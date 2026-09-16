# 07: Extract category and transaction vocabulary

**What to build:** Complete the persistence-required domain vocabulary so the
database package can depend on pure definitions rather than web-owned modules.

**Blocked by:** 06: Extract exact values and wallet vocabulary

**Status:** ready-for-agent

- [ ] Category kinds, protected-category vocabulary, and client-neutral category types have one domain owner.
- [ ] Transaction types, change actions, snapshots, filters, and client-neutral value contracts have one domain owner.
- [ ] React components, icon components, labels, form schemas, and HTTP DTOs remain outside the domain package.
- [ ] Persistence and web consumers use public feature subpaths or temporary forwarding exports.
- [ ] Existing unit, integration, type, and build checks remain green.
