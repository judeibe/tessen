# Contributing to Tessen

Thank you for contributing.

## Local development setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create `.env.local` in the repository root:

   ```bash
   VITE_HA_URL=http://homeassistant.local:8123
   VITE_HA_TOKEN=your_long_lived_access_token
   ```

3. Run the app:

   ```bash
   pnpm dev
   ```

## Branch naming

Use the format:

```text
###-feature-name
```

Examples: `001-automation-builder`, `042-entity-filtering`.

## Commit message format

Use clear, imperative commit messages:

```text
<type>: <short summary>
```

Examples:

- `feat: add flow validation for cycle detection`
- `fix: handle invalid HA auth token response`
- `test: add coverage for validateFlow size limits`

## Pull request checklist

Before opening a PR, verify:

- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] New UI component tests include `expect(await axe(container)).toHaveNoViolations()`
- [ ] Public interfaces include JSDoc comments
- [ ] Layer boundaries are respected (`components`, `flows`, `ha`, `shared`)

## Component contract documentation conventions

- Treat files in `specs/001-automation-builder/contracts/` as source-of-truth for component APIs.
- Keep prop names and event callback signatures aligned with
  [`specs/001-automation-builder/contracts/component-api.md`](specs/001-automation-builder/contracts/component-api.md).
- Add/update JSDoc for public component props and exported functions when contract behavior changes.
- When adding new UI components, include accessibility notes and required ARIA behavior in docs and tests.

### Example: JSDoc component contract documentation

```ts
/**
 * Called when the user requests a save.
 * Parent components own the async save behavior.
 */
onSave: () => void
```

### Example: required accessibility test assertion

```ts
import { axe } from 'jest-axe'

const { container } = render(<AutomationHeader {...props} />)
expect(await axe(container)).toHaveNoViolations()
```
