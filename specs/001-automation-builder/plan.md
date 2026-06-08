# Implementation Plan: Automation Builder

**Branch**: `001-automation-builder` | **Date**: 2026-06-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-automation-builder/spec.md`

## Summary

Build a visual automation builder for Home Assistant inside Tessen — a React/Vite/TypeScript
single-page application. Users drag trigger, condition, and action nodes onto a react-flow
canvas, connect them in sequence, configure each node via a side panel, and save the resulting
automation to their Home Assistant instance via the HA WebSocket API. The feature also supports
importing and editing existing HA automations rendered as flow graphs.

## Technical Context

**Language/Version**: TypeScript 5.x

**Primary Dependencies**:
- `react` + `react-dom` v18 — UI framework
- `@xyflow/react` (react-flow v12) — canvas and graph engine
- `zustand` — client-side state management
- `zundo` — undo/redo middleware for Zustand
- `home-assistant-js-websocket` — official HA WebSocket client
- `js-yaml` — HA automation YAML serialization/deserialization
- `vite` — build tool and dev server

**Storage**: No persistent database. Flow state lives in Zustand (in-memory). Automations are
persisted to Home Assistant via HA REST/WebSocket API. No local file storage.

**Testing**: Vitest (unit + integration) + React Testing Library (component tests) + axe-core
(accessibility assertions in component tests)

**Target Platform**: Desktop web browser (Chrome, Firefox, Safari latest two versions).
Mobile/touch is out of scope per spec assumptions.

**Project Type**: Single-page web application (Vite SPA)

**Performance Goals**:
- Canvas interactions feel instant (target: 60 fps) with up to 50 nodes (SC-003)
- Save operations confirmed within 5 seconds (SC-004)

**Constraints**:
- WCAG 2.1 AA — all interactive elements keyboard-navigable (SC-005)
- No cyclic edges (HA automations do not support loops)
- Blueprint automations out of scope (FR-011)
- Assumes authenticated HA connection exists (onboarding out of scope)

**Scale/Scope**: Single automation at a time on the canvas; up to 50 nodes per flow

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. SOLID Architecture | ✅ PASS | Three strict layers defined: UI (`src/components/`), Flow Logic (`src/flows/`), HA Integration (`src/ha/`). Shared types in `src/shared/`. No cross-layer leakage planned. |
| II. Layered Codebase Separation | ✅ PASS | Import direction enforced: UI → flows/ha, never flows → UI. HA layer is UI-agnostic. |
| III. Test Coverage | ✅ PASS | Vitest unit tests required for all exported functions in `src/flows/` and `src/ha/`. RTL component tests + axe assertions for all components. |
| IV. Open Contribution Standards | ✅ PASS | `CONTRIBUTING.md` and `quickstart.md` included as Phase 1 deliverables. kebab-case folders, PascalCase components. |
| V. Accessibility First (WCAG 2.1 AA) | ✅ PASS | react-flow keyboard nav enabled. Aria labels on all interactive elements. axe-core in component tests. |
| VI. CI/CD Pipeline Enforcement | ✅ PASS | GitHub Actions will run lint, `tsc --noEmit`, and full Vitest suite on every PR. |

**Post-design re-check**: Pending Phase 1 completion — will verify data model and contracts do
not introduce layer violations.

## Project Structure

### Documentation (this feature)

```text
specs/001-automation-builder/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── ha-websocket.md
│   ├── component-api.md
│   └── flow-serialization.md
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── components/               # UI Layer — rendering and interaction only
│   ├── canvas/               # react-flow canvas wrapper and config
│   │   ├── AutomationCanvas.tsx
│   │   └── edge-types/
│   │       └── ExecutionEdge.tsx
│   ├── nodes/                # react-flow custom node components
│   │   ├── TriggerNode.tsx
│   │   ├── ConditionNode.tsx
│   │   └── ActionNode.tsx
│   ├── panels/               # Sidebars, palette, config panel
│   │   ├── NodePalette.tsx
│   │   ├── NodeConfigPanel.tsx
│   │   └── AutomationHeader.tsx
│   ├── modals/
│   │   ├── ImportAutomationModal.tsx
│   │   └── ErrorModal.tsx
│   └── layout/
│       └── AppLayout.tsx
│
├── flows/                    # Flow Logic Layer — graph ops, validation, serialization
│   ├── store.ts              # Zustand store (useFlowStore) with zundo undo/redo
│   ├── validation.ts         # Cycle detection, trigger+action requirement checks
│   ├── serialization.ts      # FlowGraph ↔ HA automation YAML
│   ├── node-types.ts         # react-flow nodeTypes registry
│   └── __tests__/
│       ├── validation.test.ts
│       └── serialization.test.ts
│
├── ha/                       # HA Integration Layer — WebSocket/REST calls only
│   ├── client.ts             # home-assistant-js-websocket setup + connection
│   ├── entities.ts           # getStates, subscribeEntities
│   ├── services.ts           # getServices, callService
│   ├── automations.ts        # listAutomations, getAutomation, saveAutomation, deleteAutomation
│   └── __tests__/
│       ├── client.test.ts
│       └── automations.test.ts
│
└── shared/                   # Shared types and constants (no logic, no side effects)
    ├── types.ts              # AutomationFlow, FlowNode, FlowEdge, HAEntity, HAService
    └── constants.ts          # NODE_TYPES, TRIGGER_PLATFORMS, CONDITION_TYPES, ACTION_TYPES

public/
└── index.html

tests/
└── integration/              # Integration tests for flow composition end-to-end
    └── flow-composition.test.ts

vite.config.ts
tsconfig.json
package.json
CONTRIBUTING.md
```

**Structure Decision**: Single Vite SPA project with constitution-mandated three-layer
separation (`src/components/`, `src/flows/`, `src/ha/`) and `src/shared/` for types.
No backend — all persistence goes directly to the HA instance the user is authenticated with.

## Complexity Tracking

> No constitution violations identified. Table omitted per instructions.
