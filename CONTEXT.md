# Bookkeeping

Bookkeeping covers recording where money sits and how it moves between wallets, categories and debts.

## Language

**Account**:
The signed-in identity, identified by email, that owns all of a user's wallets, categories and transactions.
_Avoid_: Wallet, user profile

**Sign-up**:
Creating a new Account with email and password. Sign-up is either open or closed; when closed, existing Accounts can still sign in.
_Avoid_: Registration, enabled/disabled sign-up

**Wallet**:
A money holding owned by one Account, with a type of cash, bank account, or e-wallet.
_Avoid_: Account when referring to money holdings collectively

**Savings wallet**:
A Wallet of any type whose whole balance the user treats as money to keep rather than spend. Being one is a choice about the Wallet, not a type, and it does not limit what can be recorded against it.
_Avoid_: Buffer wallet, reserve, pot, savings as a wallet type

**Set aside**:
The signed balance held across a user's Savings wallets, archived ones included. On a past date it counts only the Savings wallets opened by then, and there is none before the first of them opened.
_Avoid_: Savings when referring to the amount, reserved

**Spendable**:
The signed balance held across a user's Wallets that are not Savings wallets, archived ones included. On a past date it counts only those Wallets opened by then, and there is none before the first of them opened.
_Avoid_: Safe to spend, available balance

**Total balance**:
The signed balance held across all of a user's Wallets, archived ones included; Spendable plus Set aside. On a past date it counts only the Wallets opened by then, and there is none before the first Wallet opened.
_Avoid_: Overall balance, net worth

**Opening balance**:
The amount held in a wallet on the date its tracked history begins.

**Closing balance**:
A wallet's balance at the end of a calendar date: its opening balance plus every current transaction dated on or before that date. A wallet has no Closing balance before its opening date: it was not yet tracked, which is not the same as holding zero.
_Avoid_: End-of-day balance, daily balance

**Transaction date**:
The date a money movement occurred, used to determine its effect on wallet balances and period totals.

**Recording time**:
The time a transaction was originally entered into the app, distinct from its transaction date.

**Cash movement**:
Money entering or leaving a cash, bank-account, or e-wallet Wallet, dated when that holding receives or pays the money.

**Income**:
Money received by a user from an external source, including borrowed money.
_Avoid_: Earned income when referring to all cash receipts

**Expense**:
Money paid by a user to an external recipient, including debt repayments and any interest or fees included in the payment.

**Debt payment**:
Money paid to a lender to settle a debt obligation, including the principal, interest, and fees in that payment. Debt payments include credit card bill and mortgage payments.

**Card cash advance**:
Borrowed money received from a credit card provider into a user's cash or bank-account Wallet.

**Refund**:
Money returned for an expense, reducing expenses and increasing the balance of the receiving wallet.

**Refund allowance**:
The amount of an expense not yet returned by its current refunds; a refund may not exceed it, and an expense may not be corrected below what its refunds already return.
_Avoid_: Remaining, refundable balance

**Net expenses**:
A period's expenses less the refunds dated in that period, whichever expense each refund returns. It includes debt payments and may be negative.
_Avoid_: Spending, total expenses

**Net**:
A period's income less its net expenses.
_Avoid_: Profit, savings

**Report month**:
The calendar month a report covers, written `YYYY-MM`, from `0001-01` onward. Each report month's figures cover the Transaction dates inside it.
_Avoid_: Period, reporting period

**Category spending**:
A month's net expenses for one expense category, with an expense and its refunds counted under the expense's current category.
_Avoid_: Category expenses, budget usage

**Category share base**:
A month's positive Category spending summed across expense parent categories; each parent's share of the month's spending is measured against it. Parents whose refunds outran their spending are left out, so it may exceed Net expenses, and it is zero when no parent has positive spending.
_Avoid_: Positive spending, gross category spending

**Transfer**:
Movement of money between two holdings owned by the same user.

**Source wallet**:
The wallet a transfer takes money from; shown as "From".

**Destination wallet**:
The wallet a transfer adds money to; shown as "To".

**Last-used wallet**:
The wallet of a user's most recently recorded transaction, offered as the default on a new entry.
_Avoid_: Previous wallet, likely wallet

**Correction**:
Changing a recorded transaction's wallets, category, amount, date, note or tags in place, keeping its type, refund link and recording time.
_Avoid_: Edit, amendment

**Retained wallet**:
An archived wallet that a transaction already points at, which correcting that transaction may keep even though new entries and moves cannot use archived wallets.

**Parent category**:
A category at the first level of an income or expense category tree, selectable directly on a transaction or used to group child categories.

**Child category**:
A selectable category at the second and final level of an income or expense category tree, belonging to one parent category.

**Uncategorized**:
A protected parent category in each income and expense tree, used by default and as a fallback when a parent is removed. It cannot be removed or renamed and has no children.

**Tag**:
A named label an Account reuses across its income and expense transactions to mark something that repeats but is not a category, such as a shop or a game. An income or expense carries up to five tags; a refund carries its expense's tags and a transfer carries none. Names are unique per Account, ignoring case and surrounding whitespace.
_Avoid_: Label, payee, merchant

**Note**:
Optional free text on a transaction for one-off detail that no tag or category captures.
_Avoid_: Description, memo

**Change history**:
The internal record of what a transaction or wallet looked like before and after each correction or deletion, kept for traceability and never shown as a user-facing feature.
_Avoid_: Audit log, revision

**Minor unit**:
The smallest monetary unit used to record an amount; for Thai baht, one satang.
