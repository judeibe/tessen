# Contract: Component Public API

**Layer**: `src/components/` | **Feature**: 001-automation-builder

## Design Rules

- All components are **pure renderers** — they accept props and emit events; they do NOT call
  HA APIs directly and do NOT contain flow-graph logic.
- Components read flow state via `useFlowStore` (Zustand). They dispatch actions but never
  mutate state directly.
- All interactive components MUST include appropriate ARIA attributes per WCAG 2.1 AA.

---

## `<AutomationCanvas />`

**File**: `src/components/canvas/AutomationCanvas.tsx`

Main canvas container. Renders the react-flow graph and wires up interaction handlers.

```typescript
interface AutomationCanvasProps {
  /** Called when user initiates a save. Parent handles async logic. */
  onSaveRequest: () => void;

  /** Called when user initiates an import. Parent opens ImportAutomationModal. */
  onImportRequest: () => void;
}
```

**Responsibilities**:
- Renders `<ReactFlow>` with `nodeTypes` and `edgeTypes` from `src/flows/node-types.ts`
- Handles `onConnect` — calls `addEdge` after validating no cycle (via `src/flows/validation.ts`)
- Handles `onNodesChange` / `onEdgesChange` — delegates to Zustand store
- Handles `onNodeClick` — calls `selectNode`
- Enables `panOnDrag`, `zoomOnScroll`, `fitView`
- Rejects connection if cycle detected: shows inline warning

**Accessibility**: react-flow `ariaLabel` prop set. Keyboard: arrow keys navigate selected node,
Enter opens config panel, Delete removes selected node.

---

## `<TriggerNode />`, `<ConditionNode />`, `<ActionNode />`

**Files**: `src/components/nodes/TriggerNode.tsx`, etc.

react-flow custom node components. Rendered by the canvas for each node in the flow.

```typescript
interface TriggerNodeProps {
  id: string;
  data: TriggerNodeData;
  selected: boolean;
}

interface ConditionNodeProps {
  id: string;
  data: ConditionNodeData;
  selected: boolean;
}

interface ActionNodeProps {
  id: string;
  data: ActionNodeData;
  selected: boolean;
}
```

**Shared visual contract**:
- Node card shows: type badge (color-coded), label, warning icon if `hasWarning === true`
- Warning icon MUST have `aria-label` with `warningMessage` text
- Selected state: visible focus ring (not color-only)
- Each node type has a distinct color: Trigger=blue, Condition=amber, Action=green

---

## `<NodePalette />`

**File**: `src/components/panels/NodePalette.tsx`

Sidebar panel listing draggable node types. Supports drag-to-canvas and click-to-add.

```typescript
interface NodePaletteProps {
  /** Called when user adds a node via click (canvas center) or drag (specific position). */
  onAddNode: (type: FlowNode['type'], position?: { x: number; y: number }) => void;
}
```

**Items**: `Trigger`, `Condition`, `Action` — with description and keyboard shortcut hint.

**Accessibility**: Each item is a `<button>` with `role="button"` and keyboard drag simulation
(Space to "pick up", arrow keys to position, Enter to drop).

---

## `<NodeConfigPanel />`

**File**: `src/components/panels/NodeConfigPanel.tsx`

Side panel shown when a node is selected. Renders type-specific configuration fields.

```typescript
interface NodeConfigPanelProps {
  nodeId: string;
  nodeType: FlowNode['type'];
  nodeData: TriggerNodeData | ConditionNodeData | ActionNodeData;

  /** HA entities for entity_id selectors. */
  entities: HAEntity[];

  /** HA services for action service call selectors. */
  services: HAService[];

  /** Called with partial update when user changes a field. */
  onChange: (nodeId: string, data: Partial<TriggerNodeData | ConditionNodeData | ActionNodeData>) => void;

  /** Called when user clicks Delete in the panel. */
  onDelete: (nodeId: string) => void;

  /** Called when panel is closed (node deselected). */
  onClose: () => void;
}
```

**Field rendering strategy**: Config fields are rendered generically based on HA selector types
(entity selector → searchable dropdown, text → text input, number → number input). Unknown
selector types fall back to a JSON text area with a warning.

---

## `<AutomationHeader />`

**File**: `src/components/panels/AutomationHeader.tsx`

Top bar showing automation name, save status, and action buttons.

```typescript
interface AutomationHeaderProps {
  alias: string;
  description?: string;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: string | null;
  saveError: string | null;
  onAliasChange: (alias: string) => void;
  onDescriptionChange: (description: string) => void;
  onSave: () => void;
  onImport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}
```

---

## `<ImportAutomationModal />`

**File**: `src/components/modals/ImportAutomationModal.tsx`

Modal for selecting and importing an existing HA automation.

```typescript
interface ImportAutomationModalProps {
  isOpen: boolean;
  automations: AutomationSummary[];
  isLoading: boolean;
  loadError: string | null;
  onSelect: (automationId: string) => void;
  onClose: () => void;
}
```

**Accessibility**: Modal traps focus. ESC closes. List items are keyboard-navigable.
`role="dialog"`, `aria-labelledby` pointing to modal title.

---

## `<ErrorModal />`

**File**: `src/components/modals/ErrorModal.tsx`

Generic error display modal used for save failures, connection errors, etc.

```typescript
interface ErrorModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  /** Optional: show a Retry button */
  onRetry?: () => void;
  onClose: () => void;
}
```
