# Boolean environment-variable switch conventions

Researched 2026-09-25. Scope: which string values (`on`/`off`, `true`/`false`,
`1`/`0`, presence) and which name shapes (`X_ENABLED`, `ENABLE_X`, `DISABLE_X`,
`X_DISABLED`, `NO_X`, bare `X`) first-party tools and parsers use for boolean
environment variables, compared with this repo's `AUTH_RATE_LIMIT=on|off` and
`AUTH_SIGN_UP=on|off` in `apps/server/src/core/env/config.ts`.

## Findings from primary sources

### Twelve-Factor says nothing about value format

The config factor requires config in environment variables, treated as
"granular controls, each fully orthogonal to other env vars". It prescribes
no value syntax for booleans and no naming shape.
[Twelve-Factor: Config](https://12factor.net/config)

### Environment values are untyped strings

Vite exposes custom env values as strings and says the same happens for
boolean env variables, so code must convert them. Kubernetes container `env`
entries are likewise string values.
[Vite env and mode](https://vite.dev/guide/env-and-mode),
[Kubernetes: define environment variables](https://kubernetes.io/docs/tasks/inject-data-application/define-environment-variable-container/)
Every boolean convention is therefore a parser choice, not a platform rule.

### Node.js documents its own switches as `=1` or as presence

Node's CLI reference names its switches `NODE_DISABLE_COLORS=1`,
`NODE_NO_WARNINGS=1`, `NODE_PRESERVE_SYMLINKS=1`, `NODE_USE_ENV_PROXY=1` and
`NODE_USE_SYSTEM_CA=1`; `NODE_SKIP_PLATFORM_CHECK=value` takes any value.
`FORCE_COLOR` accepts `1`, `true` or the empty string for 16 colours and `2`/`3`
for deeper colour; any other value disables colour.
[Node.js CLI: environment variables](https://nodejs.org/api/cli.html#environment-variables)

### NO_COLOR is presence-based

`NO_COLOR` disables colour when present and non-empty, regardless of value;
even `NO_COLOR=0` disables colour.
[no-color.org](https://no-color.org/)

### Docker uses `1`/`0`, true-or-1, or presence, parsed by Go

`docker build` uses BuildKit unless you opt out with `DOCKER_BUILDKIT=0`.
[docker image build](https://docs.docker.com/reference/cli/docker/image/build/)
Buildx says booleans such as `BUILDX_EXPERIMENTAL=1` are evaluated with Go's
`strconv.ParseBool`, so `true`, `1` and `T` all mean true.
[Docker build variables](https://docs.docker.com/build/building/variables/)
`ParseBool` accepts only `1, t, T, TRUE, true, True, 0, f, F, FALSE, false,
False`; `on`/`off` return an error.
[Go strconv.ParseBool](https://pkg.go.dev/strconv#ParseBool)
Docker CLI variables such as `DOCKER_TLS` and `DOCKER_HIDE_LEGACY_COMMANDS` act
when set. [Docker CLI env vars](https://docs.docker.com/reference/cli/docker/#environment-variables)
Compose documents its boolean switches, such as `COMPOSE_REMOVE_ORPHANS`, as
`true` or `1`.
[Compose environment variables](https://docs.docker.com/compose/how-tos/environment-variables/envvars/)

### GitHub Actions uses `true`, plus `1` for one runner variable

`CI` and `GITHUB_ACTIONS` are "always set to `true`"; `RUNNER_DEBUG` always has
the value `1`.
[GitHub Actions variables](https://docs.github.com/en/actions/reference/workflows-and-actions/variables)
Debug logging requires `ACTIONS_STEP_DEBUG` or `ACTIONS_RUNNER_DEBUG` set to
`true`.
[GitHub Actions debug logging](https://docs.github.com/en/actions/how-tos/monitor-workflows/enable-debug-logging)

### Next.js, Turborepo and Better Auth use `1` or `true`

Next.js opts out of telemetry with `NEXT_TELEMETRY_DISABLED=1`.
[Next.js telemetry](https://nextjs.org/telemetry)
Turborepo documents `TURBO_UI` as true or 1 versus false or 0,
`TURBO_FORCE` as `true`, and many `*_DISABLED` variables that act when set.
[Turborepo system environment variables](https://turborepo.dev/docs/reference/system-environment-variables)
Better Auth documents `BETTER_AUTH_TELEMETRY=1` / `=0` and
`BETTER_AUTH_TELEMETRY_DEBUG=1`.
[Better Auth telemetry](https://better-auth.com/docs/reference/telemetry)
Its internal `getBooleanEnvVar` treats only `"0"`, `"false"` (any case) and
empty as false. Any other set value is true, including `"off"`.
[Better Auth env-impl.ts](https://github.com/better-auth/better-auth/blob/main/packages/core/src/env/env-impl.ts)
Better Auth's code options are `rateLimit.enabled` and
`emailAndPassword.disableSignUp`.
[Better Auth options](https://better-auth.com/docs/reference/options)

### Railway documents no boolean platform switch

Railway's variable reference lists numeric and path variables such as
`RAILWAY_DEPLOYMENT_DRAINING_SECONDS` and `RAILWAY_RUN_UID`, with no
boolean-format convention.
[Railway variables reference](https://docs.railway.com/reference/variables)
Railpack's `RAILPACK_VERBOSE` is described as a switch without a stated value.
[Railpack environment variables](https://railpack.com/config/environment-variables/)

### `on`/`off` is standard in configuration files, not in env vars

PostgreSQL booleans accept `on`, `off`, `true`, `false`, `yes`, `no`, `1`,
`0`, case-insensitive, or an unambiguous prefix.
[PostgreSQL: setting parameters](https://www.postgresql.org/docs/current/config-setting.html)
nginx directives such as `sendfile` and `tcp_nodelay` take `on | off`.
[nginx core module](https://nginx.org/en/docs/http/ngx_http_core_module.html#sendfile)
Apache directives such as `KeepAlive` take `On|Off`.
[Apache core directives](https://httpd.apache.org/docs/2.4/mod/core.html#keepalive)
php.ini accepts `true`/`on`/`yes` and `false`/`off`/`no`/`none`; since 8.3 an ini
value may interpolate an env var, but the boolean syntax belongs to ini.
[PHP configuration file](https://www.php.net/manual/en/configuration.file.php)
None of these define an environment variable with an `on`/`off` value.

### Env-parsing libraries split on whether they accept `on`/`off`

Zod's `z.stringbool()` exists for cases such as parsing environment variables.
By default it accepts `true`, `1`, `yes`, `on`, `y`, `enabled` and `false`, `0`,
`no`, `off`, `n`, `disabled`, case-insensitive. Other input is a `ZodError`.
[Zod stringbool](https://zod.dev/api?id=stringbool)
envalid `bool()` accepts `1`, `0`, `true`, `false`, `t`, `f`, `yes`, `no`, `on`,
`off`. [envalid](https://github.com/af/envalid)
Pydantic lax-mode `bool` accepts `0`, `off`, `f`, `false`, `n`, `no`, `1`, `on`,
`t`, `true`, `y`, `yes`, case-insensitive.
[Pydantic booleans](https://pydantic.dev/docs/validation/latest/api/pydantic/standard_library_types/)
Spring's `StringToBooleanConverter` accepts `true`, `on`, `yes`, `1` and
`false`, `off`, `no`, `0`.
[Spring StringToBooleanConverter](https://github.com/spring-projects/spring-framework/blob/main/spring-core/src/main/java/org/springframework/core/convert/support/StringToBooleanConverter.java)
env-var `asBool()` accepts only `true`, `false` (any case), `0` or `1`;
`asBoolStrict()` only `true` or `false`.
[env-var API](https://github.com/evanshortiss/env-var/blob/master/API.md)
Go's `ParseBool`, above, rejects `on`/`off`.

These parsers are liberal in what they read. Their docs show `true`/`false`, not
`on`/`off`, as the written form. Spring's own example is
`SPRING_MAIN_LOGSTARTUPINFO=false`.
[Spring Boot external config](https://docs.spring.io/spring-boot/reference/features/external-config.html)

### Name shapes: no source prescribes one; opt-outs are often negative

Observed shapes in the sources above:

- Negative, for disabling a default-on behaviour: `NEXT_TELEMETRY_DISABLED`,
  Turborepo's `TURBO_*_DISABLED`, `NODE_DISABLE_COLORS`, `NODE_NO_WARNINGS`,
  `NO_COLOR`.
- Bare noun, with value selecting on or off: `CI`, `DOCKER_BUILDKIT`,
  `TURBO_UI`, `BETTER_AUTH_TELEMETRY`, `RUNNER_DEBUG`.
- `*_ENABLED`: Spring's many `*.enabled` properties, bound from env vars as
  `..._ENABLED` by relaxed binding, and `TURBO_DOWNLOAD_LOCAL_ENABLED`.
  [Spring Boot application properties](https://docs.spring.io/spring-boot/appendix/application-properties/index.html)
- `ENABLE_X`: no example found in the sources checked.

Feature-flag guidance does not settle this. Fowler lists command-line arguments
and environment variables as a simple toggle configuration that needs a restart
to change, and describes ops toggles and kill switches. It does not discuss
positive versus negative names.
[Fowler: Feature Toggles](https://martinfowler.com/articles/feature-toggles.html)
LaunchDarkly recommends descriptive names, such as "Kill switch: disable Acme
integration", but gives no positive/negative rule.
[LaunchDarkly flag conventions](https://launchdarkly.com/docs/guides/flags/flag-conventions)
Unleash recommends unique, patterned names and says a flag needing a restart
"is configuration, not a feature flag".
[Unleash best practices](https://docs.getunleash.io/guides/feature-flag-best-practices),
[Unleash feature flags](https://docs.getunleash.io/concepts/feature-flags)
OpenFeature defines a boolean flag as an idiomatic true or false and specifies
no env-var string form.
[OpenFeature types](https://openfeature.dev/specification/types)

### Comparison of sources and accepted values

| Source                 | Kind        | on/off | true/false  | 1/0          | presence |
| ---------------------- | ----------- | ------ | ----------- | ------------ | -------- |
| Node.js own switches   | env var     | no     | FORCE_COLOR | yes          | some     |
| NO_COLOR               | env var     | no     | no          | no           | yes      |
| Docker / Buildx (Go)   | env var     | no     | yes         | yes          | some     |
| Docker Compose         | env var     | no     | yes         | yes          | no       |
| GitHub Actions         | env var     | no     | yes         | RUNNER_DEBUG | no       |
| Next.js telemetry      | env var     | no     | no          | yes          | no       |
| Turborepo              | env var     | no     | yes         | yes          | some     |
| Better Auth helper     | env var     | wrong* | yes         | yes          | no       |
| PostgreSQL             | config file | yes    | yes         | yes          | n/a      |
| nginx / Apache         | config file | yes    | no          | no           | n/a      |
| php.ini                | config file | yes    | yes         | not stated   | n/a      |
| Zod `z.stringbool()`   | parser      | yes    | yes         | yes          | no       |
| envalid `bool()`       | parser      | yes    | yes         | yes          | no       |
| Pydantic lax `bool`    | parser      | yes    | yes         | yes          | no       |
| Spring converter       | parser      | yes    | yes         | yes          | no       |
| env-var `asBool()`     | parser      | no     | yes         | yes          | no       |
| Go `strconv.ParseBool` | parser      | no     | yes         | yes          | no       |

\* Better Auth's helper reads `off` as true, because anything except `0`,
`false` and empty is true. The repo's variables do not pass through that
helper.

## Assessment for this repo

`on`/`off` is a real boolean vocabulary. It is standard in PostgreSQL, nginx,
Apache and PHP config files, and most liberal parsers accept it, including Zod
`z.stringbool()`. As a written value for environment variables, however, none
of the first-party tools checked here documents it. Env-var switches mostly use
`1`/`0` (Node, Docker, Next.js, Better Auth telemetry) or `true`/`false`
(GitHub Actions, Compose, Turborepo, Spring), often with both accepted. Presence
is a third pattern (`NO_COLOR`). An operator is therefore likely to guess
`true`/`false` or `1`/`0` rather than `on`/`off`.

The repo's `z.enum(["on", "off"])` is strict. A guessed `true`, `1` or `false`
fails at boot rather than being misread. This avoids the silent inversion that
Better Auth's own helper would give `off`.

Alternatives, for the user to weigh:

- Keep `on`/`off`: explicit, fail-fast, and matches the config-file sense of
  "turn a server behaviour on or off", but unusual for env vars.
- Keep the bare names but use `true`/`false` (strict enum) or
  `z.stringbool()`: the most common env-var value form. `z.stringbool()` would
  also accept `on`/`off`, `1`/`0` and `yes`/`no`, so existing values keep
  working.
- Use negative opt-out names for the default-on switch, following
  `NEXT_TELEMETRY_DISABLED=1` or `NODE_DISABLE_COLORS=1`. `AUTH_SIGN_UP` would
  become, for example, `AUTH_SIGN_UP_DISABLED=1`, mirroring Better Auth's
  `disableSignUp`. This fits presence-style opt-outs but loses a single name for
  both states. It also fits `AUTH_RATE_LIMIT` poorly, because unset means
  "Better Auth's default" and both explicit values are meaningful. A bare name
  with a two-valued value suits that tri-state.
- `*_ENABLED` names, such as `AUTH_SIGN_UP_ENABLED=false`, mirror Better Auth's
  `rateLimit.enabled` and Spring's convention.

No primary source mandates any of these shapes; the evidence concerns only
which forms are common.

## Outcome

The owner chose `*_ENABLED` names with a strict `z.enum(["true", "false"])`
for both switches: `AUTH_RATE_LIMIT_ENABLED` and `AUTH_SIGN_UP_ENABLED`.
