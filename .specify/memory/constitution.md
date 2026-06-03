<!--
SYNC IMPACT REPORT
==================
Version Change: (unpublished template) → 1.0.0
Bump Type: MAJOR — initial constitution establishment from template

Principles Added:
  - I. SOLID Architecture (new)
  - II. Layered Codebase Separation (new)
  - III. Test Coverage — NON-NEGOTIABLE (new)
  - IV. Open Contribution Standards (new)
  - V. Accessibility First (new)
  - VI. CI/CD Pipeline Enforcement (new)

Sections Added:
  - Technology Stack & Tooling (new)
  - Quality Gates & Review Process (new)
  - Governance (new)

Templates Reviewed:
  - .specify/templates/plan-template.md    ✅ no changes required
  - .specify/templates/spec-template.md    ✅ no changes required
  - .specify/templates/tasks-template.md   ✅ no changes required
  - .specify/templates/checklist-template.md ✅ no changes required

Deferred Items: None — all placeholders resolved.
-->

# Tessen Constitution

## Core Principles

### I. SOLID Architecture

Every module in Tessen MUST adhere to SOLID principles:

- **Single Responsibility**: Each module, component, or service addresses exactly one concern.
  UI components render; services coordinate; utilities transform — never mixed.
- **Open/Closed**: Modules MUST be open for extension via abstractions (interfaces, hooks,
  props) and closed to direct internal modification.
- **Liskov Substitution**: Derived types MUST be substitutable for their base types without
  altering correctness.
- **Interface Segregation**: Consumers MUST NOT be forced to depend on interfaces they do not
  use. Prefer narrow, focused contracts over broad multi-purpose interfaces.
- **Dependency Inversion**: High-level modules MUST NOT depend on low-level modules. Both MUST
  depend on abstractions. Dependencies are injected, not hardcoded as concrete imports.

**Rationale**: SOLID principles reduce coupling and maximize testability — critical for an
open-source project where contributors modify isolated areas of the flow engine and HA
integration layer independently.

### II. Layered Codebase Separation

Tessen MUST maintain strict separation across three architectural layers:

1. **UI Layer** (`src/components/`): React components responsible solely for rendering and
   user interaction. Components MUST NOT contain HA API calls or raw flow-graph logic.
2. **Flow Logic Layer** (`src/flows/`): All react-flow graph operations — node creation, edge
   management, flow validation, serialization. This layer is UI-agnostic and HA-agnostic.
3. **HA Integration Layer** (`src/ha/`): All Home Assistant API communication — entity
   queries, service calls, configuration loading. This layer is UI-agnostic and flow-agnostic.

Cross-layer imports MUST flow downward only (UI → Flow Logic or HA Integration; Flow Logic
MUST NOT import from UI). Shared types and utilities belong in `src/shared/`.

**Rationale**: Decoupled layers allow independent testing of each concern, reduce merge
conflicts in a multi-contributor environment, and enable replacing the flow engine or HA
client without touching UI components.

### III. Test Coverage — NON-NEGOTIABLE

No code ships without corresponding tests. The full testing pyramid MUST be maintained:

- **Unit Tests** (Vitest): All logic functions, utilities, hooks, and store selectors MUST have
  unit coverage. Every exported function in the Flow Logic and HA Integration layers requires
  a corresponding test file.
- **Component Tests** (React Testing Library): All UI components MUST have tests validating
  rendering, user interaction, and accessibility semantics. Snapshot-only tests are
  insufficient — behavior MUST be asserted.
- **Integration Tests** (Vitest): Flow composition behavior — creating nodes, connecting edges,
  serializing/deserializing automation flows — MUST be covered by integration tests.

Test files MUST be co-located with source as `__tests__/` subdirectories or `*.test.ts(x)`
siblings. Coverage MUST not decrease on any PR.

**Rationale**: Tests are the primary safety net for an open-source visual builder. Regressions
in flow serialization or HA entity mapping would silently break end-user automations in
production Home Assistant instances.

### IV. Open Contribution Standards

Tessen MUST be structured to welcome external contributors without friction:

- `CONTRIBUTING.md` MUST exist at the repository root and MUST cover: local dev setup, branch
  naming conventions, commit message format, PR checklist, and component contract documentation
  conventions.
- All public component interfaces MUST be documented via JSDoc or inline TypeScript comments
  describing props, emitted events, and usage examples.
- File and folder names MUST follow `kebab-case`. Component files use `PascalCase.tsx`.
  Deviations require documented rationale in PR description.
- PRs MUST NOT be merged without the author or a reviewer confirming the contribution guide
  was followed.

**Rationale**: Open-source sustainability requires lowering the barrier to contribution. Clear
contracts and consistent naming reduce the cognitive load on new contributors and reviewers.

### V. Accessibility First (WCAG 2.1 AA)

All Tessen UI — including the flow builder canvas, node editors, toolbars, and modals — MUST
meet WCAG 2.1 Level AA criteria:

- Interactive elements MUST be keyboard-navigable with visible focus indicators.
- All non-decorative images and icons MUST include descriptive `aria-label` or `alt` text.
- Color alone MUST NOT convey meaning; labels or patterns MUST supplement color cues.
- Accessibility MUST be tested via automated tooling (e.g., `axe-core`, RTL accessibility
  assertions) as part of the standard component test suite.
- The react-flow canvas MUST expose keyboard equivalents for all primary pointer interactions
  (adding nodes, connecting edges, navigating the graph).

**Rationale**: The Home Assistant community is diverse. An automation builder must not exclude
users with visual, motor, or cognitive disabilities. Accessibility is a first-class feature.

### VI. CI/CD Pipeline Enforcement

The CI pipeline is the final arbiter of contribution quality. All gates MUST be automated
and enforced without exception:

- **Lint**: ESLint + Prettier MUST pass with zero warnings or errors on every PR.
- **Type Check**: `tsc --noEmit` MUST pass with zero errors on every PR.
- **Test Suite**: The full Vitest suite MUST pass (0 failures) on every PR.
- **Branch Protection**: `main` MUST require at least one approving review and all status
  checks passing before merge. Direct commits to `main` are PROHIBITED.
- **No Bypasses**: Pipeline bypasses (force pushes, admin overrides) are PROHIBITED except in
  documented incident-response scenarios, which MUST be logged as GitHub Issues.

**Rationale**: Automated gates remove subjectivity and protect `main` from regressions,
ensuring Tessen remains stable for all users at every commit.

## Technology Stack & Tooling

The following choices are stable and MUST NOT change without a constitution amendment:

| Concern               | Choice                    |
|-----------------------|---------------------------|
| Language              | TypeScript                |
| Framework             | React (Vite)              |
| Graph Engine          | react-flow                |
| Package Manager       | pnpm                      |
| Unit / Integration    | Vitest                    |
| Component Tests       | React Testing Library     |
| Linter                | ESLint                    |
| Formatter             | Prettier                  |
| CI/CD                 | GitHub Actions            |
| Hosting / VCS         | GitHub                    |

New dependencies MUST be justified against existing choices. Dependencies that duplicate
existing capabilities MUST NOT be added without removing the superseded package.

## Quality Gates & Review Process

Every pull request targeting `main` MUST satisfy all of the following before merge:

1. All GitHub Actions checks pass: lint, type check, full test suite.
2. At least one approving review from a project maintainer or designated reviewer.
3. PR description references the related issue or user story.
4. No unresolved review comments remain open.
5. Component contracts (JSDoc / TypeScript types) updated if the PR alters public interfaces.
6. Accessibility assertions added or updated if the PR touches UI components.

Reviewers MUST verify constitution compliance as part of every review. If a PR violates a
principle, the reviewer MUST request changes citing the specific principle by name and section.

## Governance

This constitution supersedes all other informal practices, README guidelines, or verbal
agreements regarding how Tessen is developed. In the event of conflict, this document governs.

**Amendment Procedure**:

1. Open a GitHub Issue titled `[Constitution] <proposed change summary>` with rationale.
2. Discussion must reach consensus among active maintainers (minimum 48-hour comment period).
3. Amending contributor creates a PR updating this file with an incremented version number.
4. PR requires at least two maintainer approvals before merge.
5. `LAST_AMENDED_DATE` MUST reflect the merge date. `CONSTITUTION_VERSION` MUST increment per
   the versioning policy below.

**Versioning Policy**:

- MAJOR: Removal or redefinition of an existing principle.
- MINOR: Addition of a new principle or material expansion of an existing one.
- PATCH: Clarifications, wording improvements, or non-semantic refinements.

**Compliance Review**: Each quarterly release milestone MUST include a review confirming that
all active PRs and recently merged code comply with this constitution. Post-merge violations
MUST be filed as GitHub Issues and resolved before the next milestone closes.

**Version**: 1.0.0 | **Ratified**: 2026-06-02 | **Last Amended**: 2026-06-02
