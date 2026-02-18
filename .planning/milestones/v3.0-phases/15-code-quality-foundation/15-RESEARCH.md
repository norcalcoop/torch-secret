# Phase 15: Code Quality Foundation - Research

**Researched:** 2026-02-16
**Domain:** ESLint, Prettier, Husky, lint-staged, TypeScript strict-mode fixes
**Confidence:** HIGH

## Summary

This phase sets up automated code quality tooling for the SecureShare codebase: ESLint 10 with typescript-eslint type-aware rules, Prettier 3.8 for formatting, Husky + lint-staged for pre-commit hooks, and fixes for 8 pre-existing TypeScript strict-mode errors across 4 files.

ESLint 10 was released on 2026-02-06 and removes all legacy eslintrc support. The flat config system is now mandatory, with new `defineConfig()` and `globalIgnores()` helpers imported from `eslint/config`. typescript-eslint v8.56.0 already supports ESLint 10 (`^8.57.0 || ^9.0.0 || ^10.0.0`). The `tseslint.config()` helper is deprecated in favor of ESLint's native `defineConfig()`.

The codebase has zero existing linting or formatting config -- no `.eslintrc`, no `.prettierrc`, no `eslint.config.*`, no `.husky/` directory. This is a clean greenfield setup. The project uses `"type": "module"` (ESM), TypeScript 5.9.3, and has a monorepo-like structure with separate client/server tsconfigs. There are 8 TypeScript errors in 4 files that must be resolved as part of this phase.

**Primary recommendation:** Use ESLint 10 flat config with `defineConfig()` from `eslint/config`, typescript-eslint v8 type-aware rules via `recommendedTypeChecked`, eslint-config-prettier/flat to disable conflicting rules, and Prettier 3.8 with prettier-plugin-tailwindcss. Husky v9 + lint-staged v16 handle pre-commit enforcement.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| QUAL-01 | ESLint 10 flat config with typescript-eslint type-aware rules enforces consistent code style | ESLint 10 `defineConfig()` + `globalIgnores()` from `eslint/config`; typescript-eslint v8 `recommendedTypeChecked` with `projectService: true`; eslint-config-prettier/flat to avoid Prettier conflicts; `disableTypeChecked` for JS config files |
| QUAL-02 | Prettier 3.8 formats all source files with consistent style | Prettier 3.8.x with `.prettierrc.json` config; prettier-plugin-tailwindcss for Tailwind class sorting; `.prettierignore` for generated/dist files |
| QUAL-03 | Husky pre-commit hooks run lint-staged on changed files before every commit | Husky v9 `npx husky init` + `"prepare": "husky"` script; lint-staged v16 with per-glob commands in `.lintstagedrc.json` |
| QUAL-04 | All pre-existing TypeScript strict-mode errors in crypto/icons/accessibility files are resolved | 8 errors in 4 files: `Uint8Array<ArrayBuffer>` explicit generics for crypto, type augmentation for vitest-axe matchers, lucide SVGProps type assertion for icons, tuple type for ioredis call spread |
| QUAL-05 | Entire codebase passes lint and format checks with zero violations | Run `npx eslint .` and `npx prettier --check .` after all fixes; add `lint`, `format`, and `format:check` npm scripts |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| eslint | 10.0.x | JavaScript/TypeScript linter | Just released 2026-02-06; flat config mandatory; industry standard |
| @eslint/js | 10.0.x | ESLint recommended rules | Provides `eslint.configs.recommended` for flat config |
| typescript-eslint | 8.56.x | TypeScript-specific linting rules | Official TypeScript ESLint integration; supports ESLint 10; type-aware rules |
| prettier | 3.8.x | Opinionated code formatter | Industry standard; 3.8.x is latest stable (2026-01-14) |
| eslint-config-prettier | latest (v10.x) | Disables ESLint rules that conflict with Prettier | Required to prevent ESLint/Prettier rule conflicts; flat config support via `/flat` import |
| husky | 9.1.x | Git hooks manager | De facto standard; v9 uses simple shell scripts in `.husky/` |
| lint-staged | 16.2.x | Run linters on staged files only | Fast pre-commit checks; v16 is current major |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| prettier-plugin-tailwindcss | latest | Tailwind CSS class sorting in Prettier | Project uses Tailwind CSS 4; sorts utility classes automatically |
| globals | latest | Global variable definitions for ESLint | Provides `globals.browser`, `globals.node` for environment-specific configs |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ESLint + Prettier | Biome | Biome is faster single-tool, but lacks typescript-eslint type-aware rules and ecosystem maturity |
| eslint-config-prettier | eslint-plugin-prettier | Plugin runs Prettier as ESLint rule (slower, noisier); config-prettier just disables conflicts (cleaner separation) |
| husky | simple-git-hooks | simple-git-hooks is lighter but husky is more battle-tested with broader community support |
| lint-staged | nano-staged | nano-staged is smaller but lint-staged has more features (parallel tasks, better error handling) |

**Installation:**
```bash
npm install --save-dev eslint @eslint/js typescript-eslint eslint-config-prettier prettier prettier-plugin-tailwindcss husky lint-staged globals
```

## Architecture Patterns

### Recommended Config File Structure

```
secureshare/
├── eslint.config.ts         # ESLint 10 flat config (TypeScript, ESM)
├── .prettierrc.json         # Prettier options
├── .prettierignore          # Files Prettier should skip
├── .lintstagedrc.json       # lint-staged glob → command mapping
├── .husky/
│   └── pre-commit           # Shell script: npx lint-staged
├── package.json             # Scripts: lint, format, format:check, prepare
├── tsconfig.json            # Root (client + server + shared)
├── server/tsconfig.json     # Server-specific (NodeNext)
└── ...
```

### Pattern 1: ESLint 10 Flat Config with defineConfig

**What:** ESLint 10 configuration using the new `defineConfig()` and `globalIgnores()` helpers.
**When to use:** All ESLint 10 projects. `defineConfig` auto-flattens arrays and provides type safety. `globalIgnores` replaces the confusing dual-purpose `ignores` key.

```typescript
// eslint.config.ts
// Source: https://eslint.org/blog/2025/03/flat-config-extends-define-config-global-ignores/
// Source: https://typescript-eslint.io/getting-started/
import { defineConfig, globalIgnores } from 'eslint/config';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier/flat';

export default defineConfig(
  // Global ignores (replaces .eslintignore)
  globalIgnores(['dist', 'client/dist', 'drizzle', 'node_modules']),

  // Base ESLint recommended rules
  eslint.configs.recommended,

  // TypeScript type-aware rules
  tseslint.configs.recommendedTypeChecked,

  // Parser options for type-aware linting
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Disable type-checked rules for JS/config files
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // Prettier must be last to override conflicting rules
  eslintConfigPrettier,
);
```

**Key details:**
- `projectService: true` auto-discovers tsconfig files (replaces manual `project` paths)
- `tsconfigRootDir: import.meta.dirname` anchors tsconfig lookup to project root
- `eslint.config.ts` is supported in ESLint 10 with `jiti >= 2.2.0` (auto-installed)
- `disableTypeChecked` is critical for `.js` config files that aren't in any tsconfig

### Pattern 2: Separate Environment Configs for Client/Server

**What:** Use `files` globs to apply different globals (browser vs. node) to client and server code.
**When to use:** Monorepo-like projects with separate client/server directories.

```typescript
import globals from 'globals';

// Within defineConfig array:
{
  files: ['client/src/**/*.ts'],
  languageOptions: {
    globals: globals.browser,
  },
},
{
  files: ['server/src/**/*.ts'],
  languageOptions: {
    globals: globals.node,
  },
},
```

### Pattern 3: lint-staged with ESLint and Prettier

**What:** Run linters on only staged files for fast pre-commit checks.
**When to use:** Every commit.

```json
// .lintstagedrc.json
{
  "*.{ts,js,mjs,cjs}": ["eslint --fix", "prettier --write"],
  "*.{json,css,md,html}": ["prettier --write"]
}
```

**Key detail:** ESLint runs first (may fix issues), then Prettier reformats. Order matters.

### Anti-Patterns to Avoid

- **Using `tseslint.config()` instead of `defineConfig()`:** `tseslint.config()` is deprecated in favor of ESLint core's `defineConfig()`. The core helper was released in ESLint v9.22.0 and is the standard going forward.
- **Running Prettier as an ESLint plugin:** Using `eslint-plugin-prettier` makes ESLint slower and noisier. Use `eslint-config-prettier` to disable conflicts and run Prettier separately.
- **Forgetting `disableTypeChecked` for JS files:** Config files like `vite.config.ts`, `drizzle.config.ts`, and `vitest.config.ts` may not be in a tsconfig `include`. Type-aware rules will error on them. Use `disableTypeChecked` for `**/*.js` files and potentially `files` patterns for config files.
- **Global `eslint --fix` in pre-commit:** Use `lint-staged` to only lint staged files. Running `eslint .` on commit is slow and checks unchanged files.
- **Ignoring `eslint.config.ts` jiti requirement:** ESLint 10 requires `jiti >= 2.2.0` for TypeScript config files. Install it explicitly or verify it's available.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Disabling ESLint rules that conflict with Prettier | Manual rule-by-rule disable | eslint-config-prettier | Covers 40+ rules across ESLint core and typescript-eslint; auto-maintained |
| Tailwind CSS class ordering | Custom sort plugin | prettier-plugin-tailwindcss | Official Tailwind Labs plugin; understands v4 class hierarchy |
| Git hook management | Manual `.git/hooks/` scripts | Husky v9 | Handles cross-platform, team-wide hooks via `.husky/` directory; survives `npm install` |
| Running linters on staged files | Custom `git diff --cached` scripts | lint-staged v16 | Handles partial staging, stashing, error recovery, parallel tasks |
| TypeScript-aware ESLint parsing | Custom parser config | typescript-eslint `projectService` | Auto-discovers tsconfigs, handles multi-project setups, zero manual config |

**Key insight:** The ESLint + Prettier + Husky + lint-staged stack has been the industry standard for 5+ years. Every piece is battle-tested and they integrate cleanly. Custom solutions invariably miss edge cases (partial staging, cross-platform hooks, rule conflicts).

## Common Pitfalls

### Pitfall 1: Config Files Not Covered by tsconfig

**What goes wrong:** ESLint type-aware rules fail on `vite.config.ts`, `vitest.config.ts`, `drizzle.config.ts`, and `eslint.config.ts` because they aren't in any tsconfig's `include`.
**Why it happens:** The root `tsconfig.json` includes `client/src/**/*.ts`, `shared/**/*.ts`, `server/src/**/*.ts` but not root-level `*.config.ts` files.
**How to avoid:** Either (a) add root config files to a tsconfig `include`, or (b) use a separate ESLint config block with `disableTypeChecked` for config files:
```typescript
{
  files: ['*.config.ts'],
  extends: [tseslint.configs.disableTypeChecked],
},
```
**Warning signs:** ESLint errors like "Parsing error: Cannot read file tsconfig.json" or "file not included in any tsconfig."

### Pitfall 2: TypeScript 5.9 Uint8Array Generic Changes

**What goes wrong:** TS 5.9 made `Uint8Array` generic over its buffer type. `Uint8Array<ArrayBufferLike>` is no longer assignable to `BufferSource` because `SharedArrayBuffer` is not assignable to `ArrayBuffer`.
**Why it happens:** TypeScript 5.7+ tightened ArrayBuffer/SharedArrayBuffer distinction per ES2024 spec.
**How to avoid:** Use explicit `Uint8Array<ArrayBuffer>` type annotations where the buffer is known to be `ArrayBuffer`, or use `as Uint8Array<ArrayBuffer>` assertion on `crypto.getRandomValues()` results.
**Warning signs:** Errors mentioning `Uint8Array<ArrayBufferLike>` not assignable to `BufferSource` or `ArrayBufferView<ArrayBuffer>`.

### Pitfall 3: vitest-axe Type Export Issue

**What goes wrong:** `toHaveNoViolations` imported from `vitest-axe/matchers` is exported as `export type`, so it can't be used as a value in `expect.extend()`. Also, `toHaveNoViolations` is not recognized on the `Assertion` type.
**Why it happens:** vitest-axe v0.1.0 has TypeScript type issues. The matchers need proper type augmentation.
**How to avoid:** Use a Vitest setup file with type augmentation:
```typescript
import 'vitest-axe/extend-expect';
```
Or manually augment:
```typescript
import type { AxeMatchers } from 'vitest-axe/matchers';
declare module 'vitest' {
  export interface Assertion extends AxeMatchers {}
  export interface AsymmetricMatchersContaining extends AxeMatchers {}
}
```
And use `// @ts-expect-error` or type assertion on the `expect.extend()` call if needed.
**Warning signs:** "cannot be used as a value because it was exported using 'export type'" and "Property 'toHaveNoViolations' does not exist on type 'Assertion'".

### Pitfall 4: ioredis `call()` Spread Type Mismatch

**What goes wrong:** `rate-limit-redis` defines `sendCommand` as `(...args: string[]) => Promise<RedisReply>`, but `ioredis.call()` expects `(command: string, ...args: (string | Buffer | number)[])`. Spreading `...args` from a `string[]` rest parameter doesn't satisfy the tuple overload.
**Why it happens:** TypeScript strict mode requires spread arguments to match tuple types exactly.
**How to avoid:** Destructure the first argument or use type assertion:
```typescript
sendCommand: (...args: string[]) =>
  redisClient.call(args[0], ...args.slice(1)) as Promise<RedisReply>,
```
Or:
```typescript
sendCommand: (...args: string[]) =>
  redisClient.call(...(args as [string, ...string[]])) as Promise<RedisReply>,
```
**Warning signs:** "A spread argument must either have a tuple type or be passed to a rest parameter."

### Pitfall 5: ESLint 10 Config Lookup Change

**What goes wrong:** ESLint 10 looks for `eslint.config.*` starting from the directory of each linted file (not cwd). In monorepos, this could find the wrong config.
**Why it happens:** Behavior change from ESLint 9 to improve monorepo support.
**How to avoid:** This project has a single root config, so it's not an issue. But be aware: if you add nested `eslint.config.*` files, they'll be used for files in those directories.
**Warning signs:** Different lint results depending on which directory you run from.

### Pitfall 6: Prettier Ignoring Generated Files

**What goes wrong:** Prettier tries to format `dist/`, `node_modules/`, `package-lock.json`, generated migration files, etc.
**Why it happens:** Prettier formats everything by default.
**How to avoid:** Create `.prettierignore`:
```
dist
client/dist
node_modules
package-lock.json
drizzle
*.png
```
**Warning signs:** Slow Prettier runs, diffs in generated files.

## Code Examples

### TypeScript Error Fixes (QUAL-04)

#### Fix 1: Crypto Uint8Array<ArrayBuffer> (encrypt.ts, keys.ts)

```typescript
// Source: https://github.com/microsoft/TypeScript/issues/62168
// encrypt.ts line 42: explicit generic on getRandomValues result
const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH)) as Uint8Array<ArrayBuffer>;

// encrypt.ts line 48: paddedBytes needs explicit type if padPlaintext returns Uint8Array<ArrayBufferLike>
// Option: assert at the encrypt call site
await crypto.subtle.encrypt(
  { name: ALGORITHM, iv },
  key,
  paddedBytes as Uint8Array<ArrayBuffer>,
);

// keys.ts line 81: rawKey from base64UrlToUint8Array is Uint8Array<ArrayBufferLike>
return crypto.subtle.importKey(
  'raw',
  rawKey as Uint8Array<ArrayBuffer>,
  ALGORITHM,
  false,
  ['decrypt'],
);
```

#### Fix 2: Lucide Icons SVGProps (icons.ts)

```typescript
// icons.ts line 92: createElement expects SVGProps but attrs has string[] values
// SVGProps type from lucide doesn't include string[] for 'class'
// Fix: type assertion on the attrs object
return createElement(icon, attrs as Parameters<typeof createElement>[1]) as SVGSVGElement;
```

#### Fix 3: vitest-axe Matchers (accessibility.test.ts)

```typescript
// Option A: Use extend-expect setup file approach
// In vitest setup file:
import 'vitest-axe/extend-expect';

// Option B: Manual augmentation + value import fix
import { toHaveNoViolations } from 'vitest-axe/matchers';
// Use @ts-expect-error if the export type issue persists:
// @ts-expect-error vitest-axe exports toHaveNoViolations as type but it works at runtime
expect.extend({ toHaveNoViolations });
```

#### Fix 4: ioredis call() Spread (rate-limit.ts)

```typescript
// rate-limit.ts line 14-15: spread args as tuple
sendCommand: (...args: string[]) =>
  redisClient.call(...(args as [string, ...string[]])) as Promise<RedisReply>,
```

### Prettier Configuration

```json
// .prettierrc.json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "semi": true,
  "plugins": ["prettier-plugin-tailwindcss"],
  "tailwindStylesheet": "./client/src/styles.css"
}
```

**Note:** `tailwindStylesheet` is needed for Tailwind CSS v4 to tell the plugin where the theme config is.

### Husky + lint-staged Setup

```bash
# Initialize Husky
npx husky init

# This creates:
# - .husky/ directory
# - .husky/pre-commit (with "npm test" default -- must be changed)
# - package.json "prepare": "husky" script
```

```shell
# .husky/pre-commit
npx lint-staged
```

### Package.json Scripts

```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "prepare": "husky"
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.eslintrc.json` / `.eslintrc.js` | `eslint.config.ts` flat config | ESLint 10 (Feb 2026) | Legacy config completely removed; flat config is only option |
| `tseslint.config()` helper | `defineConfig()` from `eslint/config` | ESLint 9.22 / typescript-eslint deprecation | Use ESLint-native helper; typescript-eslint one is deprecated |
| Manual `ignores` array in config object | `globalIgnores()` helper | ESLint 9.22+ | Explicit global ignore semantics; less confusion |
| `project: './tsconfig.json'` in parserOptions | `projectService: true` | typescript-eslint v8 | Auto-discovers tsconfigs; zero manual path config |
| eslint-plugin-prettier (Prettier as ESLint rule) | eslint-config-prettier (disable conflicts) + run Prettier separately | Current best practice | Faster, cleaner separation of concerns |
| husky v4 (complex setup in package.json) | husky v9 (`npx husky init`, shell scripts) | Husky v9 | Dramatically simpler; just shell scripts in `.husky/` |

**Deprecated/outdated:**
- `.eslintrc.*` and `.eslintignore`: Completely removed in ESLint 10
- `tseslint.config()`: Deprecated in favor of `defineConfig()` from `eslint/config`
- `ESLINT_USE_FLAT_CONFIG` env var: Removed in ESLint 10
- `--env`, `--rulesdir`, `--ignore-path` CLI flags: Removed in ESLint 10
- Prettier `trailingComma: "es5"`: Default changed to `"all"` in Prettier 3.x

## Open Questions

1. **Existing Code Formatting Drift**
   - What we know: The codebase has no Prettier config, so formatting is whatever each developer used
   - What's unclear: How many files will Prettier change when first run? Could be significant churn
   - Recommendation: Run `prettier --write .` in a dedicated commit before any other changes. This creates a clean baseline. Use `git blame --ignore-rev` to skip the formatting commit in blame.

2. **ESLint Config File TypeScript Support (jiti)**
   - What we know: ESLint 10 requires `jiti >= 2.2.0` for `.ts` config files
   - What's unclear: Whether ESLint 10 bundles jiti or requires explicit install
   - Recommendation: Use `eslint.config.ts` (preferred for type safety). If jiti is missing, install with `npm install --save-dev jiti`. Alternatively, fall back to `eslint.config.mjs` if jiti causes issues.

3. **Prettier Plugin Tailwind CSS `tailwindStylesheet` Option**
   - What we know: Tailwind CSS v4 requires the `tailwindStylesheet` option to point at the CSS entry point
   - What's unclear: Whether the plugin auto-detects the stylesheet or requires explicit config
   - Recommendation: Set `tailwindStylesheet` explicitly to `./client/src/styles.css` in `.prettierrc.json`. Test that class sorting works correctly.

## Sources

### Primary (HIGH confidence)
- ESLint v10.0.0 release blog: https://eslint.org/blog/2026/02/eslint-v10.0.0-released/ - Version, breaking changes, Node.js requirements
- ESLint v10 migration guide: https://eslint.org/docs/latest/use/migrate-to-10.0.0 - Full migration details
- ESLint defineConfig/globalIgnores blog: https://eslint.org/blog/2025/03/flat-config-extends-define-config-global-ignores/ - New helpers API
- ESLint configuration files docs: https://eslint.org/docs/latest/use/configure/configuration-files - Supported file names
- typescript-eslint dependency versions: https://typescript-eslint.io/users/dependency-versions/ - ESLint 10 support confirmed
- typescript-eslint shared configs (Context7 /typescript-eslint/typescript-eslint): flat config setup, recommendedTypeChecked, disableTypeChecked, projectService
- eslint-config-prettier (Context7 /prettier/eslint-config-prettier): flat config `/flat` import, must be last
- Husky (Context7 /typicode/husky): `npx husky init`, `"prepare": "husky"`, `.husky/pre-commit`
- Prettier 3.8 blog: https://prettier.io/blog/2026/01/14/3.8.0 - Release features
- TypeScript 5.9 Uint8Array changes: https://github.com/microsoft/TypeScript/issues/62168 - ArrayBuffer generic fix

### Secondary (MEDIUM confidence)
- lint-staged v16.2.7 releases: https://github.com/lint-staged/lint-staged/releases - Version verified
- vitest-axe setup: https://github.com/chaance/vitest-axe - Type augmentation approach
- prettier-plugin-tailwindcss: https://github.com/tailwindlabs/prettier-plugin-tailwindcss - Tailwind v4 support

### Tertiary (LOW confidence)
- Whether Prettier's first-run formatting changes will be extensive (depends on current codebase style consistency)
- Whether `jiti` needs explicit install with ESLint 10 or is auto-resolved

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All versions verified against official sources and npm; ESLint 10 compatibility confirmed for all tools
- Architecture: HIGH - Config patterns from official docs (Context7 + ESLint blog); typescript-eslint and eslint-config-prettier both verified for flat config
- Pitfalls: HIGH - TypeScript errors reproduced locally (`npx tsc --noEmit`); fix patterns from official TypeScript issues and library docs
- TypeScript fixes: HIGH - All 8 errors identified and reproduced; fix patterns verified against TS 5.9 release notes and library type definitions

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days - stable tools, no anticipated breaking changes)
