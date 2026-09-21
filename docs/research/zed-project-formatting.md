# Zed project formatting

Researched 2026-09-21. Scope: repository-level Zed settings for this pnpm
monorepo, with Biome owning code/config formatting and Prettier owning Markdown
and YAML.

## Recommendation

Keep Zed project settings in `.zed/settings.json` and make the formatter choice
explicit per language:

- Biome's first-party Zed extension formats CSS, JSON, JSONC, JavaScript, JSX,
  TypeScript, and TSX through its language server here. JSX files use Zed's
  JavaScript language scope, so the `JavaScript` entry covers both extensions.
- The current repository dependency reports HTML formatting as disabled, so HTML
  uses Zed's native Prettier formatter instead.
- The project settings omit `$schema` because this Zed build reports that
  property as invalid in `.zed/settings.json`.
- Biome's `require_config_file` option keeps that integration tied to this
  repository's root `biome.json` rather than silently using defaults elsewhere.
- Biome's safe fixes and import organization run as code actions when a buffer is
  formatted.
- Markdown and YAML use Zed's native Prettier integration, which resolves the
  repository's installed Prettier and checked-in `.prettierrc.json`.
- Formatting on save is enabled for the project. Markdown keeps trailing
  whitespace because the existing VS Code configuration explicitly preserves it.

## Why the settings are shaped this way

Zed project settings are stored at `.zed/settings.json`, override user settings
for that project, and support language-specific formatter settings.
[Zed project settings](https://github.com/zed-industries/zed/blob/main/docs/.doc-examples/configuration.md#project-settings)

Biome's official Zed integration recommends selecting Biome as a language-server
formatter per supported language rather than configuring Biome globally. It also
documents `require_config_file` and `code_actions_on_format` for project-based
configuration.
[Biome's Zed extension](https://biomejs.dev/reference/zed/)

Biome's repository config already sets space indentation and a double quote
style for JavaScript, while `.prettierrc.json` sets 2-space indentation, an
80-column width, LF endings, and Markdown/YAML behavior. The Zed settings mirror
the editor-facing indentation and line-length defaults without duplicating the
formatter rules. Zed's native Prettier integration searches upward for a local
`node_modules/prettier` and resolves the config files for the buffer path.
[Zed Prettier integration](https://github.com/zed-industries/zed/blob/main/crates/prettier/src/prettier.rs)

Zed's formatter reference documents the explicit `"prettier"` formatter for
projects that want Zed's native integration. If a future tool needs an external
formatter instead, Zed sends the buffer on standard input and expects formatted
text on standard output; Biome and Prettier also support that CLI contract.
[Zed formatter settings](https://zed.dev/docs/reference/all-settings),
[Biome CLI](https://biomejs.dev/reference/cli/),
[Prettier CLI](https://prettier.io/docs/cli)

## Operational notes

- Install the official Biome extension from Zed's Extensions view by running
  `zed: extensions` before opening a TypeScript or JavaScript file.
- Open the repository root as the Zed project so the extension finds the root
  `biome.json`; the project settings deliberately require a config file.
- Formatting on save is set explicitly because Zed's current online settings
  reference and its current default-settings source disagree about the default.
  The project should not rely on either default.
- The settings do not configure unsupported languages. Their existing Zed or
  user-level formatters remain untouched.

## Sources

- [Zed project-settings source](https://github.com/zed-industries/zed/blob/main/docs/.doc-examples/configuration.md#project-settings)
- [Zed language configuration and formatting](https://zed.dev/docs/configuring-languages)
- [Zed Markdown formatting](https://zed.dev/docs/languages/markdown)
- [Zed HTML formatting](https://zed.dev/docs/languages/html)
- [Zed YAML formatting](https://zed.dev/docs/languages/yaml)
- [Zed language snippets and JSX scope](https://zed.dev/docs/snippets)
- [Zed all-settings reference](https://zed.dev/docs/reference/all-settings)
- [Zed default settings source](https://github.com/zed-industries/zed/blob/main/assets/settings/default.json)
- [Zed Prettier integration source](https://github.com/zed-industries/zed/blob/main/crates/prettier/src/prettier.rs)
- [Biome Zed extension reference](https://biomejs.dev/reference/zed/)
- [Biome CLI reference](https://biomejs.dev/reference/cli/)
- [Prettier CLI reference](https://prettier.io/docs/cli)
