# Contract: Flow Serialization

**Layer**: `src/flows/serialization.ts` | **Feature**: 001-automation-builder

## Overview

The serialization module provides two pure functions for lossless bidirectional transformation
between Tessen's `AutomationFlow` graph representation and Home Assistant's `HAAutomationYAML`
document structure.

**Key invariant**: Any valid HA automation YAML that goes through `yamlToFlow → flowToYaml`
MUST produce output semantically equivalent to the input. No data may be silently dropped.

---

## Public API

```typescript
/**
 * Convert a Home Assistant automation YAML document into a Tessen AutomationFlow.
 *
 * @param yaml - Parsed HA automation object (not a YAML string — use js-yaml to parse first)
 * @param knownEntityIds - Set of entity IDs currently in HA. Used to flag missing entities.
 * @returns AutomationFlow with nodes positioned on a default grid layout.
 */
export function yamlToFlow(
  yaml: HAAutomationYAML,
  knownEntityIds: Set<string>,
): AutomationFlow;

/**
 * Convert a Tessen AutomationFlow back into a Home Assistant automation YAML document.
 *
 * @param flow - The AutomationFlow to serialize. MUST pass validateFlow() before calling.
 * @returns HAAutomationYAML ready for submission to the HA REST API.
 * @throws SerializationError if the flow contains nodes with unserializable config.
 */
export function flowToYaml(flow: AutomationFlow): HAAutomationYAML;
```

---

## Transformation Rules

### `yamlToFlow` Mapping

| HA YAML Field         | Flow Output                                         |
|-----------------------|-----------------------------------------------------|
| `id`                  | `AutomationFlow.id`                                 |
| `alias`               | `AutomationFlow.alias` (default: `''` if missing)  |
| `description`         | `AutomationFlow.description`                        |
| `mode`                | `AutomationFlow.mode` (default: `'single'`)         |
| `trigger[i]`          | `FlowNode { type: 'trigger', data: TriggerNodeData }` |
| `condition[i]`        | `FlowNode { type: 'condition', data: ConditionNodeData }` |
| `action[i]`           | `FlowNode { type: 'action', data: ActionNodeData }` |
| Unrecognized keys     | Stored in `AutomationFlow._unknownProps`            |

**Node ordering → edges**: Triggers connect to the first condition (if any), then to actions.
Conditions connect in sequence. Actions connect in sequence. Default layout is a vertical
left-to-right chain: all triggers → all conditions → all actions.

**Entity validation**: During import, each `entity_id` field within node configs is checked
against `knownEntityIds`. If missing, `FlowNode.data.hasWarning = true` and
`warningMessage` is set to: `"Entity '{entity_id}' was not found in Home Assistant."`.

**Label derivation**:
- Trigger: `"{platform} trigger"` (e.g., `"state trigger"`)
- Condition: `"{condition} condition"` (e.g., `"time condition"`)
- Action: Derived from service call if present (`"call light.turn_on"`), else `"{action} action"`

### `flowToYaml` Mapping

| Flow Field                    | HA YAML Output                                     |
|-------------------------------|----------------------------------------------------|
| `AutomationFlow.id`           | `id` (omitted if null — HA assigns on create)     |
| `AutomationFlow.alias`        | `alias`                                            |
| `AutomationFlow.description`  | `description` (omitted if empty)                  |
| `AutomationFlow.mode`         | `mode`                                             |
| `FlowNode (trigger)[]`        | `trigger[]` (ordered by edge topology)             |
| `FlowNode (condition)[]`      | `condition[]` (ordered by edge topology)           |
| `FlowNode (action)[]`         | `action[]` (ordered by edge topology)              |
| `AutomationFlow._unknownProps`| Spread at top level of output document             |

**Node ordering**: The edge graph is topologically sorted (Kahn's algorithm). Within each
node type group (trigger/condition/action), nodes are ordered by their topological sort index.

**Warning nodes**: Nodes with `hasWarning === true` are still serialized normally. The warning
is a visual indicator only and does not block serialization.

---

## Validation (`src/flows/validation.ts`)

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  code: 'NO_TRIGGER' | 'NO_ACTION' | 'MISSING_ALIAS' | 'CYCLE_DETECTED' | 'SIZE_LIMIT';
  message: string;
  /** Node ID if the error is node-specific */
  nodeId?: string;
}

/**
 * Validates a flow before save. Returns all errors (not just the first).
 * @param flow - The AutomationFlow to validate.
 * @param maxYamlSizeBytes - Optional HA config size limit. Default: 2MB.
 */
export function validateFlow(
  flow: AutomationFlow,
  maxYamlSizeBytes?: number,
): ValidationResult;

/**
 * Detects cycles in a directed graph of nodes and edges.
 * Uses DFS with color marking (white/gray/black).
 * Returns true if a cycle exists.
 */
export function hasCycle(nodes: FlowNode[], edges: FlowEdge[]): boolean;
```

**Validation checks** (all MUST pass before save):
1. `NO_TRIGGER` — no node with `type === 'trigger'`
2. `NO_ACTION` — no node with `type === 'action'`
3. `MISSING_ALIAS` — `flow.alias` is empty or whitespace-only
4. `CYCLE_DETECTED` — `hasCycle()` returns true
5. `SIZE_LIMIT` — serialized YAML exceeds `maxYamlSizeBytes`

---

## Error Types

```typescript
export class SerializationError extends Error {
  nodeId?: string;
  field?: string;
}
```
