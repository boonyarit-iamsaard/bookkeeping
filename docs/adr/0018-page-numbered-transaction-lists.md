# Page-numbered transaction lists

The transaction list paged by opaque cursor since its first version (see
`docs/api-parity.md`): forward only, with no total. The desktop table needs
"Page 3 of 7", a jump to the first and last page, a row count, and sorting by
date or amount, which a forward cursor cannot give. The list now takes `page`
and `pageSize` and returns `total`, for phone and desktop alike; phone's
"Older transactions" asks for the next page. Each sort breaks ties by
recording time, then id, so pages hold a stable order, and amount sorts by
size, so an expense and an income of equal amount sit together.

## Considered options

- Keep the cursor for phone and add page numbers for desktop: rejected
  because two contracts would serve one list.
- Cursor plus a count: rejected because it still cannot jump to a page.

## Consequences

- A transaction recorded while someone pages shifts later rows by one, so a
  row may show twice or be skipped across pages. One owner recording and
  paging at once makes that rare, and a reload corrects it.
- Counting reads the whole filtered list per page. One owner's ledger stays in
  the thousands of rows, so the cost is small.
