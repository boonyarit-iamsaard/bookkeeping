# Tracking implementation notes

These notes capture the accepted icon-catalog approach and implementation considerations. The tracking direction was confirmed on 2026-09-12; application stack choices and implementation planning remain separate work.

## Icon catalog

- Ship catalog definitions with the app. A definition contains a stable ID, renderer-specific icon name, browsing group, and English semantic tags.
- Persist only the chosen icon ID on a category. Group names, glyph names, and tags can evolve independently of financial records.
- Groups organize browsing; they are not transaction categories and do not determine financial behavior.
- The supplied `IconDefinition`, `ICON_GROUPS`, `iconById`, `iconsInGroup`, and `suggestIcons` design is a suitable starting point. Adapt its Expo-specific renderer typing to the selected application renderer.
- Treat IDs as permanent references. Unknown or retired IDs render the generic icon; do not silently rewrite the stored ID. Catalog definitions should be immutable and IDs unique.
- Guarantee that the generic icon exists; relying only on the first array item can produce an undefined fallback with an empty catalog.
- Normalize query and tags consistently. Prefer whole-name and whole-token matches before weaker prefix or substring matches, and make ties deterministic.
- The sample uses the strongest individual tag match, so `car insurance` can tie transport and insurance and favor catalog order. Evaluate such compound names and short-token false positives when implementing ranking; no external semantic model is required.
- Empty/unmatched queries can return no suggestions while the picker retains its preselected generic icon. Recommendation failure must never prevent saving a category.
- Confirmed 2026-09-13 (ticket 03): the picker follows the top recommendation for the typed name until the user picks an icon by hand; the generic icon is the preselection only when nothing matches. This refines the spec's "preselect a guaranteed generic icon" wording without weakening the guarantee.
- Confirmed 2026-09-13 (ticket 03): the shipped catalog holds about 100 stable ids in 12 browsing groups; the original 38 ids are unchanged.
- Catalog metadata need not be included in financial exports. Export/import is not specified for milestone one; preserving chosen category icons in a future portable backup may require carrying stable icon IDs.
