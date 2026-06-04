# Tasks: Automation Builder

**Input**: Design documents from `specs/001-automation-builder/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅ | quickstart.md ✅

**Tech Stack**: TypeScript 5.x · React 18 · Vite 5 · `@xyflow/react` v12 · Zustand + zundo · `home-assistant-js-websocket` · `js-yaml` · Vitest · React Testing Library · axe-core

**Tests**: Included — required by Constitution Principle III (no code ships without tests).

**Organization**: Grouped by user story. Each phase is independently testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable — different files, no dependencies on incomplete tasks in same phase
- **[Story]**: Maps to user story (US1/US2/US3 from spec.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bootstrap the Vite/React/TypeScript project and install all dependencies.

- [X] T001 Initialize Vite React TypeScript project at repo root: `pnpm create vite@latest . --template react-ts` and verify `vite.config.ts`, `tsconfig.json`, `index.html` created
- [X] T002 [P] Install runtime dependencies: `@xyflow/react`, `zustand`, `zundo`, `home-assistant-js-websocket`, `js-yaml` in `package.json`
- [X] T003 [P] Install dev dependencies: `vitest`, `@vitest/ui`, `@testing-library/react`, `@testing-library/user-event`, `jest-axe`, `@types/jest-axe`, `jsdom`; add Vitest config block to `vite.config.ts`; create `src/test-setup.ts` with `@testing-library/jest-dom` import
- [X] T004 [P] Configure ESLint with `eslint-plugin-react`, `eslint-plugin-react-hooks`, `@typescript-eslint`; configure Prettier; add `lint`, `lint:fix`, `typecheck` scripts to `package.json`
- [X] T005 Create full folder structure: `src/components/{canvas/edge-types,nodes,panels,modals,layout}/`, `src/flows/__tests__/`, `src/ha/__tests__/`, `src/shared/`, `tests/integration/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, HA connection client, flow store, and app shell — MUST be complete before any user story work begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 Define all shared TypeScript types in `src/shared/types.ts`: `AutomationFlow`, `FlowNode`, `TriggerNodeData`, `ConditionNodeData`, `ActionNodeData`, `FlowEdge`, `HAEntity`, `HAService`, `HAServiceField`, `HAAutomationYAML`, `AutomationSummary`, `FlowStore`
- [X] T007 [P] Define shared constants in `src/shared/constants.ts`: `NODE_TYPES`, `TRIGGER_PLATFORMS` (state, time, numeric_state, event, sun, etc.), `CONDITION_TYPES`, `ACTION_TYPES`, `DEFAULT_AUTOMATION_MODE`
- [X] T008 Implement `connectToHA()` and error classes `HAConnectionError`, `HASaveError`, `HANotFoundError` in `src/ha/client.ts` per `contracts/ha-websocket.md`
- [X] T009 Implement `hasCycle()` (DFS with white/gray/black coloring) and `validateFlow()` (NO_TRIGGER, NO_ACTION, MISSING_ALIAS, CYCLE_DETECTED, SIZE_LIMIT checks) in `src/flows/validation.ts` per `contracts/flow-serialization.md`
- [X] T010 [P] Write unit tests for all `validateFlow()` and `hasCycle()` cases (empty flow, no trigger, no action, cycle, valid flow, size limit) in `src/flows/__tests__/validation.test.ts`
- [X] T011 Implement Zustand store with `zundo` temporal middleware in `src/flows/store.ts`: all state and actions from `data-model.md` FlowStore shape; `handleSet` throttled at 200ms per research.md Decision 3 to prevent per-drag-tick history snapshots; `partialize` to track only `nodes` and `edges`
- [X] T012 [P] Create `AppLayout` shell component in `src/components/layout/AppLayout.tsx` with `aria-live` region for save status/error announcements; `role="main"` landmark; placeholder slots for header, palette, canvas, and config panel
- [X] T013 Create `CONTRIBUTING.md` at repository root covering: local dev setup (`pnpm install`, `.env.local` config), branch naming (`###-feature-name`), commit message format, PR checklist (lint/typecheck/test, accessibility assertions, JSDoc on public interfaces), component contract documentation conventions

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 — Create a New Automation (Priority: P1) 🎯 MVP

**Goal**: User can build a trigger → condition → action flow from scratch, configure each node, and save to Home Assistant.

**Independent Test**: Open app, drag one TriggerNode + one ActionNode onto canvas, connect them, fill in config, click Save — automation appears in HA within 5 seconds.

### Implementation: Flow Logic (US1)

- [X] T014 [P] [US1] Implement `flowToYaml()` with topological sort (Kahn's algorithm) to order trigger/condition/action arrays in `src/flows/serialization.ts` per `contracts/flow-serialization.md`; include `SerializationError` class
- [X] T015 [P] [US1] Write unit tests for `flowToYaml()`: valid flow, trigger-only-to-action, multiple triggers, mode field, `_unknownProps` passthrough in `src/flows/__tests__/serialization.test.ts`
- [X] T016 [P] [US1] Register react-flow `nodeTypes` map (`trigger`, `condition`, `action`) and `edgeTypes` map (`execution`) in `src/flows/node-types.ts`

### Implementation: HA Integration (US1)

- [X] T017 [P] [US1] Implement `getAllEntities()` and `subscribeToEntities()` using `home-assistant-js-websocket` `get_states` / `subscribeEntities` in `src/ha/entities.ts` per `contracts/ha-websocket.md`
- [X] T018 [P] [US1] Implement `getAllServices()` using `get_services` WebSocket message in `src/ha/services.ts`; map HA response to `HAService[]` shape from `src/shared/types.ts`
- [X] T019 [US1] Implement `saveAutomation()`, `validateAutomationConfig()` (WebSocket `validate_config`), and `deleteAutomation()` in `src/ha/automations.ts`; generate new automation ID using `Date.now().toString()` when `flow.id` is null; throw typed `HASaveError` on network/validation/size failures
- [X] T020 [P] [US1] Write unit tests (with mocked `home-assistant-js-websocket` and `fetch`) for `saveAutomation()` (create path, error path), `validateAutomationConfig()`, and `getAllEntities()` in `src/ha/__tests__/automations.test.ts` and `src/ha/__tests__/entities.test.ts`

### Implementation: UI Components (US1)

- [X] T021 [P] [US1] Implement shared `BaseNodeCard` component in `src/components/nodes/BaseNodeCard.tsx`: type badge (color-coded: Trigger=blue/Condition=amber/Action=green), label, warning icon with `aria-label` containing `warningMessage`, selected focus ring
- [X] T022 [P] [US1] Implement `TriggerNode` in `src/components/nodes/TriggerNode.tsx` using `BaseNodeCard`; source handle only (triggers can only be sources); props: `id`, `data: TriggerNodeData`, `selected`
- [X] T023 [P] [US1] Implement `ConditionNode` in `src/components/nodes/ConditionNode.tsx` using `BaseNodeCard`; source and target handles
- [X] T024 [P] [US1] Implement `ActionNode` in `src/components/nodes/ActionNode.tsx` using `BaseNodeCard`; target handle only (actions can only be targets)
- [X] T025 [P] [US1] Implement `ExecutionEdge` in `src/components/canvas/edge-types/ExecutionEdge.tsx` as a styled directed edge with arrowhead
- [X] T026 [US1] Implement `NodePalette` in `src/components/panels/NodePalette.tsx`: three draggable/clickable `<button>` items (Trigger, Condition, Action) with `onDragStart` setting `dataTransfer` node type and `onAddNode` prop for click-to-add (adds to canvas center); keyboard shortcut hints displayed
- [X] T027 [US1] Implement `NodeConfigPanel` in `src/components/panels/NodeConfigPanel.tsx`: renders type-specific fields based on `TriggerNodeData | ConditionNodeData | ActionNodeData`; `entity_id` fields use searchable dropdown from `entities` prop; action service fields use `services` prop; unknown fields render as JSON textarea with warning; Delete button calls `onDelete`; close button calls `onClose`
- [X] T028 [US1] Implement `AutomationHeader` in `src/components/panels/AutomationHeader.tsx` per `contracts/component-api.md`: inline-editable alias input, description field, Save button (shows spinner while `isSaving`, disabled if no changes), Undo/Redo buttons (disabled when `!canUndo`/`!canRedo`), save error banner, last-saved timestamp display
- [X] T029 [P] [US1] Implement `ErrorModal` in `src/components/modals/ErrorModal.tsx`: `role="dialog"`, `aria-labelledby` title, focus trap, ESC closes, optional Retry button
- [X] T030 [US1] Implement `AutomationCanvas` in `src/components/canvas/AutomationCanvas.tsx`: render `<ReactFlow>` with registered `nodeTypes`/`edgeTypes`; `onConnect` guard calls `hasCycle()` before `addEdge` — rejects connection and shows inline warning toast if cycle detected; `onDrop` handler converts screen coords via `screenToFlowPosition()` and calls `addNode`; `onDragOver` prevents default; `onNodesChange`/`onEdgesChange` delegate to store; `onNodeClick` calls `selectNode`; react-flow `ariaLabel` set; enable `fitView`
- [X] T031 [US1] Write integration test: build trigger → condition → action flow (add nodes, connect edges, set alias), call `flowToYaml()`, assert output matches expected HA YAML structure in `tests/integration/flow-composition.test.ts`
- [X] T032 [US1] Wire `App.tsx`: compose `AppLayout` with `AutomationCanvas`, `NodePalette`, `NodeConfigPanel` (shown when `selectedNodeId` set), `AutomationHeader`, `ErrorModal`; initialize HA connection from env vars; load entities and services on mount; wire save button through `validateFlow` → `validateAutomationConfig` → `saveAutomation` → `markSaved`/`setSaveError`

**Checkpoint**: US1 fully functional — user can build and save a new automation from scratch.

---

## Phase 4: User Story 2 — Visualize an Existing Automation (Priority: P2)

**Goal**: User can select an existing HA automation from a list, import it, and see all triggers/conditions/actions rendered as a connected flow graph with no data loss.

**Independent Test**: Click "Import from HA", select an existing automation, verify all its trigger/condition/action nodes render as connected nodes with correct labels and no data dropped (including any unsupported fields shown as preserved).

### Implementation: Flow Logic (US2)

- [X] T033 [US2] Implement `yamlToFlow()` in `src/flows/serialization.ts` (extend T014's file): map `trigger[]`/`condition[]`/`action[]` arrays to `FlowNode[]` with default grid layout; check each `entity_id` against `knownEntityIds` and set `hasWarning`/`warningMessage` on nodes with missing entities; store unrecognized YAML keys in `_unknownProps`; derive node labels per research.md label-derivation rules
- [X] T034 [P] [US2] Extend `src/flows/__tests__/serialization.test.ts` with `yamlToFlow()` tests: valid HA YAML, multiple triggers, missing entity warning, unknown fields round-trip, empty condition array

### Implementation: HA Integration (US2)

- [X] T035 [P] [US2] Implement `listAutomations()` and `getAutomationConfig()` in `src/ha/automations.ts` (extend T019's file): `GET /api/states` filtered to `automation.*` entities for list; `GET /api/config/automation/config/{id}` for config; document `automations.yaml`-only limitation as JSDoc comment per research.md gap #5

### Implementation: UI (US2)

- [X] T036 [P] [US2] Implement `ImportAutomationModal` in `src/components/modals/ImportAutomationModal.tsx` per `contracts/component-api.md`: `role="dialog"`, focus trap, ESC closes, scrollable automation list with `state` badge, loading spinner, error state, keyboard-navigable list items
- [X] T037 [US2] Wire import flow into `App.tsx`: "Import from HA" button in `AutomationHeader` opens `ImportAutomationModal`; on select → call `getAutomationConfig` → call `yamlToFlow(yaml, knownEntityIds)` → call `setFlow`; show `ErrorModal` on fetch failure; nodes with `hasWarning` render with visual warning badge

**Checkpoint**: US1 + US2 both independently functional.

---

## Phase 5: User Story 3 — Edit and Update an Existing Automation (Priority: P3)

**Goal**: User can import a previously saved automation, modify it (add/remove nodes and edges, change config), and save the updated version back to HA — replacing the original without duplication.

**Independent Test**: Import an automation, add one new ActionNode, click Save — the automation in HA has the new action; the original is replaced not duplicated.

- [X] T038 [US3] Verify `saveAutomation()` in `src/ha/automations.ts` uses `POST /api/config/automation/config/{id}` (update) when `flow.id` is non-null and `POST /api/config/automation/config` (create) when null; ensure response ID is stored via `markSaved`; add JSDoc clarifying replace vs create semantics
- [X] T039 [P] [US3] Add `lastSavedAt` display to `AutomationHeader` in `src/components/panels/AutomationHeader.tsx`: show formatted timestamp (e.g. "Saved 2 minutes ago") for last-write-wins transparency per spec edge case
- [X] T040 [US3] Write integration test covering full edit round-trip: `yamlToFlow` → add node via store → `flowToYaml` → assert new action present and `id` preserved (not duplicated) in `tests/integration/flow-composition.test.ts`

**Checkpoint**: All three user stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility hardening, CI pipeline, performance validation, and contribution docs.

- [X] T041 [P] Add `jest-axe` accessibility assertions to component tests for `AutomationCanvas`, `NodePalette`, `NodeConfigPanel`, `AutomationHeader`, `ImportAutomationModal`, `ErrorModal` — each gets `expect(await axe(container)).toHaveNoViolations()` — create `src/components/**/__tests__/*.test.tsx` files
- [X] T042 [P] Implement keyboard drag simulation for `NodePalette` in `src/components/panels/NodePalette.tsx`: Space to "pick up" a node type, arrow keys to position, Enter to drop at center — enables WCAG 2.1 AA pointer-interaction equivalence per spec SC-005
- [X] T043 [P] Add `react-flow` performance props to `AutomationCanvas` in `src/components/canvas/AutomationCanvas.tsx`: wrap all custom node components with `React.memo`, set `onlyRenderVisibleElements` — validate canvas stays responsive at 50 nodes per SC-003
- [X] T044 Add GitHub Actions CI workflow in `.github/workflows/ci.yml`: jobs for `lint` (`pnpm lint`), `typecheck` (`pnpm typecheck`), `test` (`pnpm test`) — triggered on push and pull_request to `main`; require all jobs to pass for merge per Constitution Principle VI
- [X] T045 [P] Add `.env.local.example` at repo root documenting `VITE_HA_URL` and `VITE_HA_TOKEN` variables; update `quickstart.md` link to demo HA instance; add `automations.yaml`-only limitation note
- [X] T046 Finalize `CONTRIBUTING.md`: add component contract documentation examples (JSDoc props + accessibility assertions), link to `contracts/component-api.md`; add PR checklist item confirming `axe` assertions added for any new UI component

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    └── Phase 2 (Foundational)    ← BLOCKS all user stories
            ├── Phase 3 (US1)     ← MVP, no story deps
            ├── Phase 4 (US2)     ← Depends on Phase 3 (needs serialization.ts from T014)
            └── Phase 5 (US3)     ← Depends on Phase 4 (needs yamlToFlow from T033)
                    └── Phase 6 (Polish)
```

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2. No dependency on US2/US3.
- **US2 (P2)**: Depends on US1 for `serialization.ts` file (extends `flowToYaml` with `yamlToFlow`); depends on Phase 2 store to call `setFlow`.
- **US3 (P3)**: Depends on US2 for import capability; the edit-and-resave scenario requires a loaded automation.

### Within Each Phase

- `src/shared/types.ts` (T006) must exist before any implementation task
- `src/flows/validation.ts` (T009) must complete before `src/flows/store.ts` (T011)
- Store (T011) must complete before `AutomationCanvas` (T030) and `App.tsx` (T032)
- All node components (T022–T024) must complete before `AutomationCanvas` (T030)
- `flowToYaml` (T014) must complete before integration test (T031)
- `yamlToFlow` (T033) must complete before import wiring (T037)

---

## Parallel Opportunities

### Phase 2 — Run simultaneously after T006 (types)

```
T007 (constants)  ─┐
T008 (HA client)  ─┤── all unblock once types exist
T009 (validation) ─┤
T012 (AppLayout)  ─┘
```

### Phase 3 — Run simultaneously after Phase 2

```
# Flow logic (parallel group):
T014 (flowToYaml)  T015 (flowToYaml tests)  T016 (nodeTypes)

# HA layer (parallel group):
T017 (entities)  T018 (services)  T019 (automations save)  T020 (HA tests)

# Node components (parallel group):
T021 (BaseNodeCard)  →  T022 (TriggerNode)  T023 (ConditionNode)  T024 (ActionNode)  T025 (ExecutionEdge)
```

### Phase 6 — All tasks marked [P] can run simultaneously

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational — **CRITICAL, blocks everything**
3. Complete Phase 3: User Story 1 — build and save automations from scratch
4. **STOP and VALIDATE**: Open app, build a 3-node flow, save, verify in HA
5. Ship MVP

### Incremental Delivery

1. **Phase 1+2** → Foundation ready
2. **+ Phase 3** → Users can create new automations (MVP!)
3. **+ Phase 4** → Users can import and view existing automations
4. **+ Phase 5** → Users can edit and update existing automations
5. **+ Phase 6** → Accessible, CI-gated, performance-validated

### Parallel Team Strategy

After Phase 2 completes:
- **Dev A**: Phase 3 — flow logic (T014–T016) + HA integration (T017–T020)
- **Dev B**: Phase 3 — UI components (T021–T029)
- Both converge on T030 (AutomationCanvas) → T031–T032 (test + App wiring)

---

## Notes

- `[P]` tasks touch different files and have no incomplete dependencies — safe to parallelize
- `[Story]` label maps each task to its user story for traceability against spec.md
- Every exported function in `src/flows/` and `src/ha/` requires a corresponding test (Constitution III)
- All UI components require RTL + axe-core tests (Constitution III + V)
- Never import from `src/ha/` inside `src/components/` — layer violation caught by ESLint import rules
- Only `automations.yaml`-managed automations accessible via REST API — document in UI and CONTRIBUTING.md
- Commit after each task group; each phase checkpoint is a valid demo point
