# Personal Finance

Personal finance covers tracking money, planning budgets, and forecasting future finances.

## Language

**Account**:
The signed-in identity, identified by email, that owns all of a user's wallets, categories and transactions.
_Avoid_: Wallet, user profile

**Wallet**:
A money holding owned by one Account, with a type of cash, bank account, or e-wallet.
_Avoid_: Account when referring to money holdings collectively

**Opening balance**:
The amount held in a wallet on the date its tracked history begins.

**Transaction date**:
The date a money movement occurred, used to determine its effect on wallet balances and period totals.

**Recording time**:
The time a transaction was originally entered into the app, distinct from its transaction date.

**Income**:
Money received by a user from an external source.

**Expense**:
Money spent by a user on an external recipient.

**Refund**:
Money returned for an expense, reducing expenses and increasing the balance of the receiving wallet.

**Refund allowance**:
The amount of an expense not yet returned by its current refunds; a refund may not exceed it, and an expense may not be corrected below what its refunds already return.
_Avoid_: Remaining, refundable balance

**Transfer**:
Movement of money between two holdings owned by the same user.

**Source wallet**:
The wallet a transfer takes money from; shown as "From".

**Destination wallet**:
The wallet a transfer adds money to; shown as "To".

**Last-used wallet**:
The wallet of a user's most recently recorded transaction, offered as the default on a new entry.
_Avoid_: Previous wallet, likely wallet

**Retained wallet**:
An archived wallet that a transaction already points at, which correcting that transaction may keep even though new entries and moves cannot use archived wallets.

**Parent category**:
A category at the first level of an income or expense category tree, selectable directly on a transaction or used to group child categories.

**Child category**:
A selectable category at the second and final level of an income or expense category tree, belonging to one parent category.

**Uncategorized**:
A protected parent category in each income and expense tree, used by default and as a fallback when a parent is removed. It cannot be removed or renamed and has no children.

**Change history**:
The internal record of what a transaction or wallet looked like before and after each correction or deletion, kept for traceability and never shown as a user-facing feature.
_Avoid_: Audit log, revision

**Minor unit**:
The smallest monetary unit used to record an amount; for Thai baht, one satang.
