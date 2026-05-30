# Releasing PincerPay packages

This repo publishes four public packages to npm. They are released together as a
single **linked set** and always share the same version number:

- [`@pincerpay/core`](packages/core) - shared types, chain configs, constants
- [`@pincerpay/agent`](packages/agent) - agent-side `fetch` wrapper
- [`@pincerpay/merchant`](packages/merchant) - merchant middleware
- [`@pincerpay/mcp`](packages/mcp) - MCP server

## Version-coupling contract

**Bump them together.** The `.changeset/config.json` `linked` group ties
`core`, `agent`, `merchant`, and `mcp` to one version. A changeset that touches
any one of them moves all four to the same new version, even if a package had no
functional change. (That is why, e.g., `merchant` and `mcp` 0.9.0 were
package.json-only bumps.)

**`merchant` pins `core` exact.** In the published manifests the workspace
protocol resolves `@pincerpay/core` to the **exact** current version (not `^`).
So installing a given `@pincerpay/merchant` always pulls the matching `core`.
Treat `core` + `agent` + `merchant` (+ `mcp`) as one unit when upgrading.

**Internal dependency bumps are `minor`.** `updateInternalDependencies: "minor"`
means a consumer-visible bump to one package propagates as at least a minor bump.

**Versions can be skipped.** `0.7.0` was never published; the line went
`0.6.0 → 0.8.0 → 0.9.0`. Don't assume contiguous versions.

### Compatibility matrix

| If you install | You also get (matching) |
|----------------|-------------------------|
| `@pincerpay/merchant@X` | `@pincerpay/core@X` (exact pin) |
| `@pincerpay/agent@X`    | `@pincerpay/core@X`             |
| `@pincerpay/mcp@X`      | `@pincerpay/core@X`             |

Always install the four at the same `X`.

## Per-package changelogs

Each package ships a `CHANGELOG.md` (listed in its `files` array, so it lands on
npm). `changeset version` appends to these automatically from the changeset
markdown files. **Do not gitignore `CHANGELOG.md`** - earlier it was ignored,
which is why no consumer-facing summary shipped through several releases.

When you change the `merchant` middleware context contract, the `agent` `.fetch`
surface, or any exported type in `core`, say so in a changeset so it reaches the
changelog.

## Cutting a release (GA)

Releases run from CI (`.github/workflows/publish.yml`) via
[`changesets/action`](https://github.com/changesets/action):

1. Land PRs that each include a changeset (`pnpm changeset`).
2. The action opens/maintains a **"chore: version packages"** PR that applies the
   version bumps and updates the changelogs.
3. Merging that PR to `master` triggers `pnpm release`
   (`build && test && changeset publish`), which publishes to npm under the
   `latest` dist-tag and pushes git tags.

> If `master` shows a bumped version but npm and git tags do not, the publish
> step failed (commonly a failed `build`/`test` or a missing/expired `NPM_TOKEN`
> secret). Re-run the Release workflow after fixing the underlying cause.

## Cutting a prerelease (`next` dist-tag)

To let downstream consumers validate a build ahead of GA, publish the current
versions to the npm `next` dist-tag without changing version numbers or the
`latest` tag:

```bash
pnpm release:next
```

This runs `build && test` and then `changeset publish --tag next`. Consumers
install with `npm install @pincerpay/merchant@next` (and the matching
`core`/`agent`/`mcp@next`). When the build is validated, promote it to `latest`:

```bash
npm dist-tag add @pincerpay/core@<version> latest
npm dist-tag add @pincerpay/agent@<version> latest
npm dist-tag add @pincerpay/merchant@<version> latest
npm dist-tag add @pincerpay/mcp@<version> latest
```

Requires an npm token with publish rights for the `@pincerpay` scope
(`NODE_AUTH_TOKEN` / `npm login`). Publishing and tagging are **manual,
owner-run** steps; CI only publishes `latest` on merge of the version PR.
