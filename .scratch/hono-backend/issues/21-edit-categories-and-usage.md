# 21: Edit categories and inspect their usage

**What to build:** Let an authenticated client update category presentation
details and obtain the usage information needed before category removal.

**Blocked by:** 19: Expose category trees as read-only resources

**Status:** ready-for-agent

- [ ] Category update and usage operations move to the application package without duplicating validation.
- [ ] Updates preserve tree position and enforce protected Uncategorized, name, icon, uniqueness, ownership, and missing-resource rules.
- [ ] Usage reads report the existing transaction and child information required by management UX.
- [ ] Successful updates return the direct updated category representation.
- [ ] Application and HTTP tests cover normal, protected, duplicate, cross-owner, and unauthenticated behavior.
