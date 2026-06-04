# Research: Automation Builder

**Feature**: 001-automation-builder | **Phase**: 0

Resolves all NEEDS CLARIFICATION items from the Technical Context and documents key
technology decisions for the implementation team.

---

## Decision 1: Home Assistant API Strategy

**Decision**: Use the **HA REST API** for automation CRUD and **`home-assistant-js-websocket`**
for entity/service discovery and connection management.

**Rationale**:
The HA WebSocket API (via `home-assistant-js-websocket`) is the official browser client for
HA. It provides built-in reconnection, auth handshake, and subscription support. However,
automation configuration read/write is exposed via the HA REST API
(`/api/config/automation/config/{id}`) — not via WebSocket messages. The hybrid approach
(WebSocket for discovery, REST for CRUD) mirrors what HA's own frontend does.

**Key endpoints**:
- `GET /api/config/automation/config/{id}` — fetch automation YAML as JSON
- `POST /api/config/automation/config/{id}` — create or update automation
- `DELETE /api/config/automation/config/{id}` — delete automation
- WebSocket `get_states` — fetch all entity states
- WebSocket `get_services` — fetch all callable services

**Authentication**: Long-Lived Access Token (LLAT) in `Authorization: Bearer {token}` header.
The onboarding feature (out of scope) is responsible for obtaining and storing the token.

**Alternatives considered**:
- WebSocket-only via `hassio_api` — limited automation config support, not recommended
- HACS custom integration — adds unnecessary complexity; REST API is sufficient

---

## Decision 2: State Management — Zustand + zundo

**Decision**: **Zustand v4** for flow state management, wrapped with **zundo v2** for
undo/redo history.

**Rationale**:
Zustand is lightweight (~1KB), has excellent TypeScript support, and integrates naturally
with react-flow's `useNodesState`/`useEdgesState` patterns. The store shape maps cleanly
to react-flow's node/edge arrays.

`zundo` (temporal middleware for Zustand) provides undo/redo by maintaining a history stack
of state snapshots. It supports selective tracking (only track canvas mutations, not
selection/hover state) via the `partialize` option. This avoids complex manual history
management.

```typescript
// Example setup
import { temporal } from 'zundo';
import { create } from 'zustand';

const useFlowStore = create(
  temporal(
    (set) => ({
      nodes: [],
      edges: [],
      // ... actions
    }),
    {
      // CRITICAL: throttle history writes — onNodesChange fires on every drag tick
      // without this you get ~60 snapshots/sec during node drag
      handleSet: (handleSet) =>
        throttle<typeof handleSet>((state) => {
          handleSet(state);
        }, 200),
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
      }),
    }
  )
);

// Undo/redo
const { undo, redo, pastStates, futureStates } = useFlowStore.temporal.getState();
```

**Alternatives considered**:
- Redux Toolkit — too heavyweight for a single-feature SPA; Zustand is sufficient
- react-flow's built-in `useUndoable` helper — does not exist in v12; zundo is the
  community-standard solution
- Manual history stack — error-prone; zundo handles edge cases (debounce, max history, etc.)

---

## Decision 3: react-flow Version and Custom Node Pattern

**Decision**: Use **`@xyflow/react` v12** (the npm package name for react-flow v12).

**Rationale**:
react-flow was repackaged as `@xyflow/react` in v12. It is the current stable release with
full React 18 support, improved TypeScript types, and the `useReactFlow` hook for programmatic
access. The custom node pattern uses the `nodeTypes` prop:

```typescript
// src/flows/node-types.ts
import { TriggerNode, ConditionNode, ActionNode } from '../components/nodes';

export const nodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  action: ActionNode,
};

// Usage in AutomationCanvas:
<ReactFlow nodeTypes={nodeTypes} ... />
```

**Drag-to-canvas pattern**: The `NodePalette` uses HTML5 drag events. On `onDrop` in the
canvas, `reactFlow.screenToFlowPosition(event)` converts drop coordinates to canvas space,
then `addNode` is called with the computed position.

**Cycle prevention**: react-flow's `onConnect` callback receives proposed edge; call
`hasCycle(newEdges)` before accepting. If cycle detected, call `event.preventDefault()` /
return without adding the edge, and display a toast warning.

**Alternatives considered**:
- `reactflow` v11 — older API, not recommended for new projects
- Custom SVG canvas — prohibitively complex; react-flow solves pan/zoom/selection

---

## Decision 4: HA Automation YAML Serialization

**Decision**: Use **`js-yaml`** for YAML string parsing/stringification. Internal
representation uses plain TypeScript objects (`HAAutomationYAML` interface).

**Rationale**:
HA's REST API accepts and returns JSON (with YAML semantics). For display/export purposes,
`js-yaml` serializes to valid HA YAML. The REST API POST body is JSON, not YAML string —
so `js-yaml` is needed only for display/export, not for the primary save path.

**HA Automation structure** (standard, non-blueprint):
```yaml
id: "abc123"               # Unique ID (HA assigns if not provided)
alias: "Turn on lights"    # Human name (required)
description: ""            # Optional
mode: single               # single | restart | queued | parallel
trigger:
  - platform: state        # Each trigger is an object with a "platform" key
    entity_id: light.kitchen
    to: "on"
condition:                 # Optional array; all conditions must pass
  - condition: time
    after: "18:00:00"
    before: "23:00:00"
action:                    # Required array of actions
  - service: notify.mobile_app
    data:
      message: "Kitchen light on"
```

Key insight: `trigger`, `condition`, `action` arrays preserve order. The flow graph's
topological sort order determines the serialized order.

**Alternatives considered**:
- `yaml` (js-yaml alternative) — functionally equivalent; `js-yaml` has wider adoption

---

## Decision 5: Accessibility Implementation Strategy

**Decision**: Leverage **react-flow's built-in keyboard navigation** + custom ARIA attributes
+ **`axe-core`** (via `@axe-core/react` and `jest-axe`) for automated a11y testing.

**Rationale**:
react-flow v12 includes built-in keyboard support:
- Nodes are focusable via Tab
- Arrow keys move focused node
- `Delete`/`Backspace` deletes selected elements
- `Enter` can trigger custom actions (used to open config panel)

Additional WCAG 2.1 AA requirements not covered by react-flow defaults:
- Node palette items need `role="button"` with keyboard drag simulation
- Config panel must trap focus when open
- All color cues (node type colors) supplemented with text labels
- `aria-live` region for save status and error announcements

**Test setup**:
```typescript
import { axe } from 'jest-axe';

test('NodeConfigPanel has no accessibility violations', async () => {
  const { container } = render(<NodeConfigPanel ... />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

**Alternatives considered**:
- Manual a11y testing only — insufficient per constitution (Principle V)
- `cypress-axe` — overkill without E2E test infrastructure; `jest-axe` in RTL tests is sufficient

---

## Decision 6: Build Tooling and Project Initialization

**Decision**: Vite 5 with `@vitejs/plugin-react` (SWC compiler for fast HMR).

**Initialization command**:
```bash
pnpm create vite@latest . --template react-ts
```

**Key `vite.config.ts` settings**:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
```

Note: Vitest config is co-located in `vite.config.ts` — no separate `vitest.config.ts` needed.

**Alternatives considered**:
- CRA (Create React App) — deprecated, not recommended
- Next.js — SSR overhead unnecessary for a desktop-first SPA with no public routes

---

## Decision 7: Pre-Save Validation via HA WebSocket

**Decision**: Use the HA WebSocket `validate_config` message to validate trigger/condition/action
configs against HA's own schema **before** submitting to the REST API.

**Rationale**: HA exposes a `validate_config` WebSocket command that validates automation
component configs server-side without saving. This catches HA-specific schema errors (e.g.,
invalid service names, malformed selectors) that Tessen's own validation cannot know about.

```typescript
// Call before POST to REST API
connection.sendMessagePromise({
  type: 'validate_config',
  trigger: [...],   // optional
  condition: [...], // optional
  action: [...]     // optional
});
// Response: { trigger: { valid: true, error: null }, ... }
```

**Integration point**: `src/ha/automations.ts` → called from the save flow before REST POST.

---

## Open Questions Resolved

| Question | Resolution |
|----------|------------|
| Does HA expose automation CRUD via WebSocket? | No. Use REST API (`/api/config/automation/config/`). WebSocket for entity/service discovery + `validate_config`. |
| Which state manager integrates best with react-flow? | Zustand — minimal API, works with react-flow's node/edge array state. |
| How to implement undo/redo? | zundo temporal middleware for Zustand. Partialize to track only nodes/edges. **Critical**: use zundo's `handleSet` throttle option — `onNodesChange` fires on every drag tick, producing 60 snapshots/sec without throttling. |
| How to handle entities that disappear from HA? | Flag with `hasWarning` on import; don't block editing. |
| How to prevent cycles? | DFS cycle detection in `hasCycle()` called before `addEdge`. |
| What YAML library to use? | `js-yaml` for YAML string output; HA REST API uses JSON natively. |
| react-flow package name in v12? | `@xyflow/react` |
| How to generate new automation IDs? | Use `Date.now().toString()` — HA convention for UI-created automations. Any unique string works. |
| Which automations are accessible via REST API? | Only automations managed via `automations.yaml` (not inline in `configuration.yaml`). App must target `automations.yaml`-managed automations — document this as a known limitation. |
