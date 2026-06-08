# Data Model: Automation Builder

**Feature**: 001-automation-builder | **Phase**: 1 Design

## Overview

All types are defined in `src/shared/types.ts`. The flow graph maps bidirectionally
to a standard Home Assistant automation YAML document. The key constraint is that
the graph must always be a **directed acyclic graph (DAG)** — HA automations do not
support cycles.

---

## Core Entities

### AutomationFlow

Top-level container for a single Home Assistant automation represented as a flow graph.

```typescript
interface AutomationFlow {
  /** HA automation ID (e.g. "automation.notify_on_light_on"). Null for unsaved flows. */
  id: string | null;

  /** Human-readable name. Maps to HA `alias` field. Required before save. */
  alias: string;

  /** Optional description. Maps to HA `description` field. */
  description?: string;

  /**
   * HA automation mode. Controls what happens when a trigger fires while the
   * automation is already running.
   * @default 'single'
   */
  mode: 'single' | 'restart' | 'queued' | 'parallel';

  /** All nodes in the flow (trigger, condition, action). */
  nodes: FlowNode[];

  /** Directed edges representing execution order. */
  edges: FlowEdge[];

  /** ISO timestamp of last successful save to HA. Null if never saved. */
  lastSavedAt: string | null;
}
```

**Validation Rules**:
- MUST contain at least one `FlowNode` with `type === 'trigger'`
- MUST contain at least one `FlowNode` with `type === 'action'`
- `alias` MUST be a non-empty string
- `edges` MUST form a DAG (no cycles)
- `mode` defaults to `'single'` if not specified

**State Transitions**:
```
unsaved → saved (after successful POST/PUT to HA)
saved → dirty (after any canvas edit)
dirty → saved (after successful save)
dirty → conflict (if HA version newer than last known save — show timestamp warning)
```

---

### FlowNode

A single step in the automation. Maps to one entry in the HA `trigger`, `condition`,
or `action` arrays.

```typescript
interface FlowNode {
  /** Unique node ID within the flow (UUID v4). */
  id: string;

  /** Determines which section of HA YAML this node serializes to. */
  type: 'trigger' | 'condition' | 'action';

  /** react-flow canvas position. */
  position: { x: number; y: number };

  /** Type-discriminated configuration payload. */
  data: TriggerNodeData | ConditionNodeData | ActionNodeData;
}
```

---

### TriggerNodeData

Configuration for a `trigger` node. Maps to one item in the HA `trigger:` array.

```typescript
interface TriggerNodeData {
  /** Display label shown on the node card. Auto-derived from platform + config. */
  label: string;

  /**
   * HA trigger platform. Examples:
   *   'state' | 'time' | 'numeric_state' | 'event' | 'homeassistant' |
   *   'mqtt' | 'sun' | 'template' | 'time_pattern' | 'webhook' | 'zone'
   */
  platform: string;

  /**
   * Platform-specific HA trigger fields.
   * Stored as opaque config to support all HA trigger platforms without
   * enumerating every field. Validated against HA schema at save time.
   */
  config: Record<string, unknown>;

  /** True when a referenced entity_id no longer exists in HA. */
  hasWarning: boolean;

  /** Human-readable warning message shown on the node if hasWarning is true. */
  warningMessage?: string;
}
```

---

### ConditionNodeData

Configuration for a `condition` node. Maps to one item in the HA `condition:` array.

```typescript
interface ConditionNodeData {
  label: string;

  /**
   * HA condition type. Examples:
   *   'state' | 'numeric_state' | 'time' | 'sun' | 'template' |
   *   'zone' | 'trigger' | 'and' | 'or' | 'not'
   */
  condition: string;

  config: Record<string, unknown>;

  hasWarning: boolean;
  warningMessage?: string;
}
```

---

### ActionNodeData

Configuration for an `action` node. Maps to one item in the HA `action:` array.

```typescript
interface ActionNodeData {
  label: string;

  /**
   * HA action type. Examples:
   *   'call-service' | 'delay' | 'wait_template' | 'wait_for_trigger' |
   *   'choose' | 'if' | 'repeat' | 'stop' | 'fire_event' | 'set_conversation_response'
   */
  action: string;

  config: Record<string, unknown>;

  hasWarning: boolean;
  warningMessage?: string;
}
```

---

### FlowEdge

A directed connection between two nodes. Represents execution order.

```typescript
interface FlowEdge {
  /** Unique edge ID within the flow (UUID v4). */
  id: string;

  /** ID of the source node (the upstream node). */
  source: string;

  /** ID of the target node (the downstream node). */
  target: string;

  /**
   * Always 'execution'. Only one edge type is valid in this version.
   * Stored for future extensibility (e.g., 'else' branch from choose actions).
   */
  type: 'execution';
}
```

**Validation Rules**:
- Source and target MUST reference existing node IDs in the flow
- Adding an edge MUST NOT create a cycle — validated in `src/flows/validation.ts`
- A `trigger` node may only appear as a `source`, never a `target`
  (triggers cannot have upstream dependencies)

---

### HAEntity

A Home Assistant entity. Fetched via `src/ha/entities.ts`, used in node configuration panels.

```typescript
interface HAEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  /** Derived from attributes.friendly_name */
  friendlyName: string;
  /** Derived from entity_id prefix (e.g., 'light', 'sensor', 'switch') */
  domain: string;
  /** True if entity was present when the automation was imported but is no longer in HA */
  isMissing?: boolean;
}
```

---

### HAService

A callable Home Assistant service. Fetched via `src/ha/services.ts`, used in action node config.

```typescript
interface HAService {
  domain: string;
  service: string;
  name?: string;
  description?: string;
  fields: Record<string, HAServiceField>;
}

interface HAServiceField {
  name?: string;
  description?: string;
  required?: boolean;
  selector?: Record<string, unknown>; // HA selector schema
  default?: unknown;
}
```

---

## HA YAML ↔ Flow Graph Mapping

The `src/flows/serialization.ts` module owns this bidirectional transformation.

| HA YAML Key         | Flow Graph Equivalent                          |
|---------------------|------------------------------------------------|
| `alias`             | `AutomationFlow.alias`                         |
| `description`       | `AutomationFlow.description`                   |
| `mode`              | `AutomationFlow.mode`                          |
| `trigger[i]`        | `FlowNode` where `type === 'trigger'` (ordered by edge topology) |
| `condition[i]`      | `FlowNode` where `type === 'condition'`        |
| `action[i]`         | `FlowNode` where `type === 'action'`           |
| (implicit order)    | `FlowEdge` direction defines execution order   |

**Unrecognized properties**: Any HA YAML key not mapped above is stored in
`AutomationFlow._unknownProps: Record<string, unknown>` and round-tripped
transparently to prevent data loss (satisfies FR-005 / acceptance scenario 4).

---

## Zustand Store Shape

Defined in `src/flows/store.ts`. Wrapped with `zundo` for undo/redo history.

```typescript
interface FlowStore {
  // State
  flow: AutomationFlow | null;
  selectedNodeId: string | null;
  isDirty: boolean;
  saveError: string | null;

  // react-flow adapter state (kept in sync with flow.nodes/edges)
  nodes: Node[];   // @xyflow/react Node type
  edges: Edge[];   // @xyflow/react Edge type

  // Actions
  setFlow: (flow: AutomationFlow) => void;
  addNode: (type: FlowNode['type'], position: { x: number; y: number }) => void;
  removeNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: Partial<TriggerNodeData | ConditionNodeData | ActionNodeData>) => void;
  addEdge: (edge: Omit<FlowEdge, 'id'>) => void;
  removeEdge: (edgeId: string) => void;
  selectNode: (nodeId: string | null) => void;
  setAlias: (alias: string) => void;
  setDescription: (description: string) => void;
  markSaved: (savedAt: string) => void;
  setSaveError: (error: string | null) => void;
  undo: () => void;
  redo: () => void;
}
```

**undo/redo scope**: All `addNode`, `removeNode`, `updateNodeData`, `addEdge`, `removeEdge`
actions are tracked by zundo. Connection/selection-only state changes are excluded from history.
