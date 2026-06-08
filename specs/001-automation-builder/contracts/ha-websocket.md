# Contract: Home Assistant WebSocket API

**Layer**: `src/ha/` | **Feature**: 001-automation-builder

## Overview

Tessen communicates with Home Assistant using:
1. **WebSocket API** via `home-assistant-js-websocket` for real-time state, entity/service
   discovery, and connection lifecycle.
2. **HA REST API** via `fetch` for reading and writing automation configuration
   (`/api/config/automation/config/{id}` endpoints), since the WebSocket API does not
   expose automation CRUD directly.

All HA communication is encapsulated in `src/ha/`. No other layer may import from this module.

---

## Connection Setup (`src/ha/client.ts`)

```typescript
import {
  createConnection,
  createLongLivedTokenAuth,
  ERR_CANNOT_CONNECT,
  ERR_INVALID_AUTH,
} from 'home-assistant-js-websocket';

/** Assumes caller has already obtained a Long-Lived Access Token via onboarding. */
export async function connectToHA(haUrl: string, token: string): Promise<Connection>;
```

**Auth**: Long-Lived Access Token (LLAT) stored in app state by the onboarding feature.
**Error codes exposed**:
- `ERR_CANNOT_CONNECT` — network unreachable or HA down
- `ERR_INVALID_AUTH` — token rejected

---

## Entity Discovery (`src/ha/entities.ts`)

### `getStates`
Fetch all current entity states.

```
WebSocket message: { type: "get_states" }
Response: HassEntity[] (home-assistant-js-websocket type)
```

```typescript
export async function getAllEntities(conn: Connection): Promise<HAEntity[]>;
```

### `subscribeEntities`
Subscribe to entity state changes for live updates in node config panels.

```typescript
export function subscribeToEntities(
  conn: Connection,
  callback: (entities: Record<string, HAEntity>) => void,
): UnsubscribeFunc;
```

---

## Service Discovery (`src/ha/services.ts`)

### `getServices`
Fetch all callable HA services.

```
WebSocket message: { type: "get_services" }
Response: Record<domain, Record<service, HAServiceDef>>
```

```typescript
export async function getAllServices(conn: Connection): Promise<HAService[]>;
```

---

## Automation CRUD (`src/ha/automations.ts`)

HA automation config is managed via the **REST API** (not WebSocket), requiring the base URL
and token in addition to the WebSocket connection.

### List Automations

```
GET /api/states
Filter: entity_id starts with "automation."
```

```typescript
export async function listAutomations(
  haUrl: string,
  token: string,
): Promise<AutomationSummary[]>;

interface AutomationSummary {
  id: string;          // e.g. "automation.notify_on_light_on"
  alias: string;
  state: 'on' | 'off' | 'unavailable';
}
```

### Get Automation Config

```
GET /api/config/automation/config/{automation_id}
Response: HA automation YAML document as JSON
```

```typescript
export async function getAutomationConfig(
  haUrl: string,
  token: string,
  automationId: string,
): Promise<HAAutomationYAML>;
```

### Save / Create Automation

```
POST /api/config/automation/config/{automation_id}   ← update existing
POST /api/config/automation/config                   ← create new (HA generates ID)
Content-Type: application/json
Body: HAAutomationYAML
```

```typescript
export async function saveAutomation(
  haUrl: string,
  token: string,
  automation: HAAutomationYAML,
  existingId?: string,
): Promise<{ id: string }>;
```

**Error handling**:
- Network failure mid-save: throw `HASaveError` with `code: 'NETWORK'`
- HA validation rejection: throw `HASaveError` with `code: 'VALIDATION'` + HA error message
- Canvas state MUST NOT be mutated on failure (handled by caller in `src/flows/store.ts`)

### Delete Automation

```
DELETE /api/config/automation/config/{automation_id}
```

```typescript
export async function deleteAutomation(
  haUrl: string,
  token: string,
  automationId: string,
): Promise<void>;
```

### Validate Config Before Save

Use HA's `validate_config` WebSocket command to validate trigger/condition/action arrays
against HA's own schema before submitting to the REST API.

```typescript
// src/ha/automations.ts
export async function validateAutomationConfig(
  conn: Connection,
  parts: {
    trigger?: Record<string, unknown>[];
    condition?: Record<string, unknown>[];
    action?: Record<string, unknown>[];
  },
): Promise<{ trigger: { valid: boolean; error: string | null };
             condition: { valid: boolean; error: string | null };
             action: { valid: boolean; error: string | null } }>;
```

---

## Known Limitation: `automations.yaml` Only

The REST `config/automation/config/{id}` endpoints **only work for automations managed via
`automations.yaml`**. Automations defined inline in `configuration.yaml` (as labeled blocks)
are NOT accessible via this API. Tessen must document this requirement for users.

---

```typescript
export class HAConnectionError extends Error {
  code: 'CANNOT_CONNECT' | 'INVALID_AUTH' | 'CONNECTION_LOST';
}

export class HASaveError extends Error {
  code: 'NETWORK' | 'VALIDATION' | 'SIZE_LIMIT';
  haMessage?: string; // HA's error response body if available
}

export class HANotFoundError extends Error {
  automationId: string;
}
```

---

## HA Automation YAML Shape (reference)

```yaml
id: "unique_id"           # Required for REST CRUD
alias: "My Automation"    # Human name
description: ""
mode: single
trigger:
  - platform: state
    entity_id: light.living_room
    to: "on"
condition:
  - condition: time
    after: "20:00:00"
    before: "23:00:00"
action:
  - service: notify.mobile_app
    data:
      message: "Light turned on"
```

TypeScript representation:

```typescript
interface HAAutomationYAML {
  id?: string;
  alias: string;
  description?: string;
  mode?: 'single' | 'restart' | 'queued' | 'parallel';
  trigger: Record<string, unknown>[];
  condition?: Record<string, unknown>[];
  action: Record<string, unknown>[];
  [key: string]: unknown; // preserve unrecognized fields
}
```
