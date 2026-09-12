# 07: Record and correct linked refunds

**What to build:** Record full or partial refunds from an expense's detail, choose where money arrives, and correct refunds while protecting the original expense and its remaining refundable amount.

**Blocked by:** 06: Manage wallet lifecycle and opening corrections.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Start refund entry from an existing owned expense, never the general creation type picker. Lock type/link, show expense category/date/amount/remaining allowance, and inherit category read-only.
- [ ] Prefill the remaining refundable amount and original wallet only if active. For an archived original wallet leave receiving wallet unselected and require an explicit active choice or unarchive; never silently substitute another wallet.
- [ ] Without active receiving wallets, show create/unarchive actions and prevent submission. Allow a receiving wallet different from the original expense's wallet.
- [ ] Amounts follow positive exact-satang limits; combined nondeleted refunds cannot exceed the expense. Dates cannot precede the expense or receiving opening, or exceed Bangkok today.
- [ ] Creation reuses idempotency/snapshot retry handling. Refunds increase the receiving balance and reduce expenses; they are not income or changes to the original expense amount.
- [ ] Show refund as a distinct list/detail type linked to its expense. Permit valid edit/delete with original recording time preserved and atomic internal history; refund edits exclude their own old amount from the allowance calculation.
- [ ] Block expense deletion while refunds exist, reductions below refunded totals, and date edits that invalidate refund ordering. Explain remaining allowance and list linked refunds when they block deletion.
- [ ] Refunds always use the expense's current category, including subsequent category removal fallbacks. Do not permit independent refund categorization.
- [ ] Concurrent refunds cannot exceed the expense. Serialize refund creates/edits/deletes against expense corrections/deletion and receiving-wallet archive so committed records always obey constraints.
- [ ] Existing refunds on archived wallets remain editable according to retained-wallet rules; changing to another archived wallet is rejected.
- [ ] Apply impeccable to the confirmed refund chip, locked fields, actionable wallet fallback, validation, and keyboard/phone/desktop behavior.
- [ ] PostgreSQL tests prove partial/full limits, competing refunds, date rules, different wallets, expense guards, rollback/history, owner isolation, and duplicate saves. Browser coverage includes linked entry, archived-original fallback, and blocked expense correction.
- [ ] Run relevant tests and existing repository checks.

## Scope and handoff

Category management verifies refund fallbacks in 08; monthly own-date refund reporting follows in 09. Covers spec criteria 1–3, 5–6, 8, 10–14, 20, 23–25 for refund behavior.
