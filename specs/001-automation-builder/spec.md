# Feature Specification: Automation Builder

**Feature Branch**: `001-automation-builder`

**Created**: 2026-06-02

**Status**: Draft

**Input**: User description: "I want to be able to visualize and create automations for
home-assistant via tessen."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Create a New Automation (Priority: P1)

A user opens Tessen and builds a new automation from scratch. They add trigger nodes (e.g.,
"when a light turns on"), optional condition nodes (e.g., "only between sunset and sunrise"),
and action nodes (e.g., "send a notification"). They connect the nodes in sequence, configure
each node's properties using a sidebar panel, and save the completed automation to their Home
Assistant instance.

**Why this priority**: Creating automations is the core value proposition of Tessen. Without
this, nothing else in the builder has purpose. It is the minimum deliverable that makes the
product useful.

**Independent Test**: A user can open Tessen with no prior data, build a trigger → condition →
action flow, configure all nodes, and confirm the automation appears in their Home Assistant
automation list after saving.

**Acceptance Scenarios**:

1. **Given** an empty canvas, **When** the user drags a trigger node onto the canvas,
   **Then** a named trigger node appears on the canvas and is selectable.
2. **Given** a trigger node on the canvas, **When** the user drags an action node and draws
   an edge from trigger to action, **Then** the edge is rendered and the connection is
   persisted in the flow state.
3. **Given** a connected flow, **When** the user clicks "Save to Home Assistant",
   **Then** the automation appears in the Home Assistant automation list within 5 seconds.
4. **Given** an incomplete flow (no trigger or no action), **When** the user attempts to save,
   **Then** the system displays a descriptive validation error and does not save.

---

### User Story 2 — Visualize an Existing Automation (Priority: P2)

A user imports an automation that already exists in their Home Assistant instance into Tessen.
The automation renders as a visual flow graph on the canvas, preserving all triggers,
conditions, and actions as nodes with their configured properties intact.

**Why this priority**: Existing HA users have many automations. The ability to visualize them
provides immediate value and builds trust in the tool before users commit to creating new
ones.

**Independent Test**: A user selects "Import from Home Assistant", chooses an existing
automation, and verifies the rendered graph correctly represents all the automation's triggers,
conditions, and actions with no data loss.

**Acceptance Scenarios**:

1. **Given** a user is connected to Home Assistant, **When** they open the import flow,
   **Then** a list of all existing automations is presented for selection.
2. **Given** the user selects an automation, **When** it loads, **Then** the canvas displays
   trigger, condition, and action nodes connected by directed edges matching the automation
   structure.
3. **Given** an automation with multiple triggers and conditions, **When** it renders,
   **Then** all triggers and conditions appear as distinct nodes with their properties visible.
4. **Given** any valid HA automation YAML, **When** imported, **Then** no data is silently
   dropped — any unsupported or unrecognized properties are preserved and flagged visually.

---

### User Story 3 — Edit and Update an Existing Automation (Priority: P3)

A user opens a previously saved or imported automation, modifies it (adds/removes nodes,
changes node configuration, rewires connections), and saves the updated version back to Home
Assistant, replacing the original.

**Why this priority**: Editing is essential for long-term utility but can be incrementally
delivered after create and visualize are stable.

**Independent Test**: A user imports an existing automation, adds a new action node, and
confirms the automation in Home Assistant reflects the change after saving.

**Acceptance Scenarios**:

1. **Given** a loaded automation on the canvas, **When** the user adds a new node and saves,
   **Then** the Home Assistant automation is updated with the new node's configuration.
2. **Given** a loaded automation, **When** the user deletes a node and all its edges,
   **Then** the node and edges are removed from the canvas and from the saved automation.
3. **Given** a modified automation, **When** the user saves, **Then** the previous version
   is replaced in Home Assistant (not duplicated).

---

### Edge Cases

- What happens when the HA connection drops mid-save? The system MUST surface an error, leave
  the local canvas unchanged, and allow retry.
- What happens when an imported automation references an entity that no longer exists in HA?
  The node MUST render with a visual warning but not block editing.
- What happens when a user draws a cyclic edge (creating a loop)? The system MUST reject the
  connection and display a warning, as HA automations do not support cycles.
- What happens when two users edit the same automation simultaneously? Last-write-wins with a
  visible timestamp of the last save shown in the UI.
- What happens when the automation YAML exceeds the HA config size limit? The system MUST
  display a size warning before attempting to save.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to add trigger, condition, and action nodes to the canvas by
  dragging from a node palette or via a context menu.
- **FR-002**: Users MUST be able to connect nodes with directed edges representing execution
  flow (trigger → condition → action).
- **FR-003**: Users MUST be able to configure each node's properties (entity selection, service
  call, parameter values) via a side panel or inline editor.
- **FR-004**: Users MUST be able to save a completed automation flow directly to their
  connected Home Assistant instance.
- **FR-005**: Users MUST be able to import and visualize any existing Home Assistant automation
  as a flow graph without data loss.
- **FR-006**: Users MUST be able to delete nodes and edges from the canvas.
- **FR-007**: Users MUST be able to assign a name and optional description to each automation.
- **FR-008**: The system MUST validate that a flow contains at least one trigger and one action
  before allowing a save.
- **FR-009**: The system MUST surface actionable error messages for save failures,
  connection errors, and validation violations.
- **FR-010**: Users MUST be able to undo and redo canvas operations (add, delete, connect,
  configure).
- **FR-011**: Blueprint-based automations are explicitly out of scope. The builder supports
  only standard HA automations (trigger / condition / action). Blueprint support is deferred
  to a follow-on feature.

### Key Entities

- **Automation Flow**: The top-level graph representing a single HA automation. Has a name,
  description, and collection of nodes and edges.
- **Node**: A single step in the flow. Types: Trigger, Condition, Action. Each node holds a
  type-specific configuration payload mapping to HA automation YAML fields.
- **Edge**: A directed connection between two nodes, representing execution order.
- **HA Entity**: A Home Assistant device or service (lights, sensors, switches, media players)
  that a node's configuration may reference.
- **HA Service**: A callable Home Assistant service (e.g., `light.turn_on`) referenced by
  action nodes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with no prior Tessen experience can build and save a complete 3-node
  automation (trigger → condition → action) in under 5 minutes.
- **SC-002**: 100% of standard Home Assistant automation structures (trigger, condition,
  action combinations) can be imported and rendered without data loss.
- **SC-003**: The canvas remains responsive (interactions feel instant) with flows containing
  up to 50 nodes.
- **SC-004**: Save operations complete and are confirmed within 5 seconds under normal
  connectivity conditions.
- **SC-005**: All interactive elements in the builder are operable via keyboard alone
  (WCAG 2.1 AA compliance).
- **SC-006**: Users can import, modify, and re-save an existing automation with zero
  unintended data mutations.

## Assumptions

- The user has a running Home Assistant instance accessible to the Tessen application
  (local network or remote via HA Cloud).
- Authentication and initial connection setup between Tessen and Home Assistant are handled
  by a separate onboarding feature; this feature assumes an authenticated, active connection
  is already established.
- Blueprint-based automations are out of scope for this iteration unless clarification
  (FR-011) resolves to include them.
- The initial supported node types are: Trigger, Condition, and Action — matching the
  standard HA automation YAML top-level keys.
- Scenes and Scripts, while related, are out of scope for this feature and addressed
  separately.
- The canvas is desktop-browser-first; mobile/touch optimization is a future concern.
