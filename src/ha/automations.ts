import type { Connection } from 'home-assistant-js-websocket'

import type { AutomationMode, AutomationSummary, HAAutomationYAML } from '../shared/types'
import { HANotFoundError, HASaveError } from './client'

type ValidationSectionResult = {
  valid: boolean
  error: string | null
}

type ValidationParts = {
  trigger?: Record<string, unknown>[]
  condition?: Record<string, unknown>[]
  action?: Record<string, unknown>[]
}

interface ValidationResponse {
  trigger?: ValidationSectionResult
  condition?: ValidationSectionResult
  action?: ValidationSectionResult
}

interface HAStateEntity {
  entity_id?: string
  state?: string
  attributes?: {
    friendly_name?: string
    id?: string
  }
}

const VALIDATION_FALLBACK_ERROR =
  'Home Assistant did not return a validation result for this section.'
const KNOWN_AUTOMATION_KEYS = new Set([
  'id',
  'alias',
  'description',
  'mode',
  'trigger',
  'condition',
  'action',
])

function getBaseUrl(haUrl: string): string {
  return haUrl.endsWith('/') ? haUrl.slice(0, -1) : haUrl
}

function createAuthHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function readHAErrorMessage(response: Response): Promise<string | undefined> {
  const contentType = response.headers.get('content-type')

  try {
    if (contentType?.includes('application/json')) {
      const payload = (await response.json()) as
        | { message?: string; error?: string }
        | undefined
      return payload?.message ?? payload?.error
    }

    const text = await response.text()
    return text || undefined
  } catch {
    return undefined
  }
}

function normalizeValidationSection(
  section: ValidationSectionResult | undefined,
  wasRequested: boolean,
): ValidationSectionResult {
  if (!wasRequested) {
    return { valid: true, error: null }
  }

  if (!section || typeof section.valid !== 'boolean') {
    return { valid: false, error: VALIDATION_FALLBACK_ERROR }
  }

  return {
    valid: section.valid,
    error: section.error ?? null,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isAutomationMode(value: unknown): value is AutomationMode {
  return (
    value === 'single' ||
    value === 'restart' ||
    value === 'queued' ||
    value === 'parallel'
  )
}

function toRecordArray(
  value: unknown,
  fieldName: 'triggers' | 'conditions' | 'actions',
  required = false,
): Record<string, unknown>[] {
  console.log('toRecordArray', { value, fieldName, required })
  if (!Array.isArray(value)) {
    if (required) {
      throw new HASaveError(
        'VALIDATION',
        `Home Assistant returned automation data with an invalid '${fieldName}' field.`,
      )
    }
    return []
  }

  if (!value.every(isRecord)) {
    throw new HASaveError(
      'VALIDATION',
      `Home Assistant returned an invalid '${fieldName}' array.`,
    )
  }

  return value
}

/**
 * Lists automations exposed by Home Assistant's REST API.
 *
 * @remarks
 * Home Assistant only exposes automations managed in `automations.yaml` through this endpoint.
 * Automations declared inline in `configuration.yaml` are not available.
 */
export async function listAutomations(
  haUrl: string,
  token: string,
): Promise<AutomationSummary[]> {
  const baseUrl = getBaseUrl(haUrl)
  const url = `${baseUrl}/api/states`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: createAuthHeaders(token),
    })
  } catch (error) {
    throw new HASaveError(
      'NETWORK',
      'Network failure while listing automations.',
      undefined,
      {
        cause: error,
      },
    )
  }

  if (!response.ok) {
    const haMessage = await readHAErrorMessage(response)
    throw new HASaveError(
      'NETWORK',
      `Failed to list automations. Home Assistant responded with status ${response.status}.`,
      haMessage,
    )
  }

  const payload = (await response.json()) as unknown
  if (!Array.isArray(payload)) {
    throw new HASaveError(
      'VALIDATION',
      'Home Assistant returned an invalid automations list response.',
    )
  }

  return payload
    .filter(isRecord)
    .map((entry) => entry as HAStateEntity)
    .filter((entry) => typeof entry.entity_id === 'string')
    .filter((entry) => entry.entity_id?.startsWith('automation.'))
    .map((entry) => ({
      id: entry.attributes?.id ?? '',
      alias:
        typeof entry.attributes?.friendly_name === 'string' &&
        entry.attributes.friendly_name.trim().length > 0
          ? entry.attributes.friendly_name
          : entry.entity_id ?? '',
      state:
        entry.state === 'on' || entry.state === 'off' || entry.state === 'unavailable'
          ? entry.state
          : 'unavailable',
    }))
}

/**
 * Gets a Home Assistant automation config by entity ID.
 *
 * @remarks
 * This endpoint only supports automations managed in `automations.yaml`.
 */
export async function getAutomationConfig(
  haUrl: string,
  token: string,
  automationId: string,
): Promise<HAAutomationYAML> {
  const baseUrl = getBaseUrl(haUrl)
  const url = `${baseUrl}/api/config/automation/config/${encodeURIComponent(automationId)}`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: createAuthHeaders(token),
    })
  } catch (error) {
    throw new HASaveError(
      'NETWORK',
      `Network failure while loading automation '${automationId}'.`,
      undefined,
      {
        cause: error,
      },
    )
  }

  if (response.status === 404) {
    throw new HANotFoundError(automationId)
  }

  if (!response.ok) {
    const haMessage = await readHAErrorMessage(response)
    throw new HASaveError(
      'NETWORK',
      `Failed to load automation '${automationId}'.`,
      haMessage,
    )
  }

  const payload = (await response.json()) as unknown
  if (!isRecord(payload)) {
    throw new HASaveError(
      'VALIDATION',
      `Home Assistant returned invalid automation data for '${automationId}'.`,
    )
  }

  const trigger = toRecordArray(payload.triggers, 'triggers', true)
  const actions = toRecordArray(payload.actions, 'actions', true)
  const conditions =
    payload.conditions === undefined
      ? undefined
      : toRecordArray(payload.conditions, 'conditions')

  if (typeof payload.alias !== 'string') {
    throw new HASaveError(
      'VALIDATION',
      `Home Assistant returned automation '${automationId}' without an alias.`,
    )
  }

  const normalized: HAAutomationYAML = {
    alias: payload.alias,
    trigger,
    action: actions,
  }

  if (typeof payload.id === 'string') {
    normalized.id = payload.id
  }

  if (typeof payload.description === 'string') {
    normalized.description = payload.description
  }

  if (isAutomationMode(payload.mode)) {
    normalized.mode = payload.mode
  }

  if (conditions) {
    normalized.condition = conditions
  }

  for (const [key, value] of Object.entries(payload)) {
    if (!KNOWN_AUTOMATION_KEYS.has(key)) {
      normalized[key] = value
    }
  }

  return normalized
}

/**
 * Saves a Home Assistant automation configuration.
 *
 * @remarks
 * When `existingId` is provided (the imported flow already has an ID), this updates and replaces
 * the existing automation via `POST /api/config/automation/config/{id}`.
 * When `existingId` is missing (new flow), this creates a new automation via
 * `POST /api/config/automation/config`.
 */
export async function saveAutomation(
  haUrl: string,
  token: string,
  automation: HAAutomationYAML,
  existingId?: string,
): Promise<{ id: string }> {
  const baseUrl = getBaseUrl(haUrl)
  const normalizedExistingId =
    typeof existingId === 'string' && existingId.trim().length > 0
      ? existingId
      : undefined
  const normalizedAutomationId =
    typeof automation.id === 'string' && automation.id.trim().length > 0
      ? automation.id
      : undefined
  const resolvedId = normalizedExistingId ?? normalizedAutomationId ?? Date.now().toString()
  const isUpdate = Boolean(normalizedExistingId)
  const url = isUpdate
    ? `${baseUrl}/api/config/automation/config/${encodeURIComponent(resolvedId)}`
    : `${baseUrl}/api/config/automation/config`

  const requestBody: HAAutomationYAML = isUpdate
    ? { ...automation, id: normalizedExistingId }
    : { ...automation, id: normalizedAutomationId ?? resolvedId }

  let response: Response

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: createAuthHeaders(token),
      body: JSON.stringify(requestBody),
    })
  } catch (error) {
    throw new HASaveError(
      'NETWORK',
      'Network failure while saving automation.',
      undefined,
      {
        cause: error,
      },
    )
  }

  if (!response.ok) {
    const haMessage = await readHAErrorMessage(response)

    if (response.status === 413) {
      throw new HASaveError(
        'SIZE_LIMIT',
        'Automation payload exceeds Home Assistant size limit.',
        haMessage,
      )
    }

    if (response.status === 400 || response.status === 422) {
      throw new HASaveError(
        'VALIDATION',
        'Home Assistant rejected automation configuration.',
        haMessage,
      )
    }

    throw new HASaveError(
      'NETWORK',
      `Failed to save automation. Home Assistant responded with status ${response.status}.`,
      haMessage,
    )
  }

  try {
    const payload = (await response.json()) as { id?: string }
    if (typeof payload?.id === 'string' && payload.id.length > 0) {
      return { id: payload.id }
    }
  } catch {
    // Some HA responses do not include a JSON payload.
  }

  return { id: resolvedId }
}

export async function validateAutomationConfig(
  conn: Connection,
  parts: ValidationParts,
): Promise<{
  trigger: ValidationSectionResult
  condition: ValidationSectionResult
  action: ValidationSectionResult
}> {
  try {
    const response = await conn.sendMessagePromise<ValidationResponse>({
      type: 'validate_config',
      ...parts,
    })

    return {
      trigger: normalizeValidationSection(response.trigger, Boolean(parts.trigger)),
      condition: normalizeValidationSection(
        response.condition,
        Boolean(parts.condition),
      ),
      action: normalizeValidationSection(response.action, Boolean(parts.action)),
    }
  } catch (error) {
    throw new HASaveError(
      'VALIDATION',
      'Unable to validate automation configuration with Home Assistant.',
      undefined,
      {
        cause: error,
      },
    )
  }
}

export async function deleteAutomation(
  haUrl: string,
  token: string,
  automationId: string,
): Promise<void> {
  const baseUrl = getBaseUrl(haUrl)
  const url = `${baseUrl}/api/config/automation/config/${encodeURIComponent(automationId)}`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'DELETE',
      headers: createAuthHeaders(token),
    })
  } catch (error) {
    throw new HASaveError(
      'NETWORK',
      `Network failure while deleting automation '${automationId}'.`,
      undefined,
      {
        cause: error,
      },
    )
  }

  if (response.status === 404) {
    throw new HANotFoundError(automationId)
  }

  if (!response.ok) {
    const haMessage = await readHAErrorMessage(response)
    throw new HASaveError(
      'NETWORK',
      `Failed to delete automation '${automationId}'.`,
      haMessage,
    )
  }
}
