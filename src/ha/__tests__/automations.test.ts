import type { Connection } from 'home-assistant-js-websocket'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { HAAutomationYAML } from '../../shared/types'
import { HANotFoundError } from '../client'
import {
  deleteAutomation,
  getAutomationConfig,
  listAutomations,
  saveAutomation,
  validateAutomationConfig,
} from '../automations'

const HA_URL = 'http://homeassistant.local:8123'
const TOKEN = 'token-value'

const createJsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const BASE_AUTOMATION: HAAutomationYAML = {
  alias: 'Test automation',
  mode: 'single',
  triggers: [{ platform: 'state', entity_id: 'light.kitchen', to: 'on' }],
  actions: [{ service: 'light.turn_on' }],
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('saveAutomation', () => {
  it('creates a new automation via create endpoint and falls back to Date.now() id', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValue(createJsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000)

    const result = await saveAutomation(HA_URL, TOKEN, BASE_AUTOMATION)

    expect(result).toEqual({ id: '1700000000000' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      `${HA_URL}/api/config/automation/config`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        }),
      })
    )

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.id).toBe('1700000000000')
  })

  it('updates an existing automation via id endpoint when existingId is provided', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValue(
      createJsonResponse({ id: 'automation.updated' })
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await saveAutomation(
      HA_URL,
      TOKEN,
      { ...BASE_AUTOMATION, id: 'stale-id' },
      'automation.existing'
    )

    expect(result).toEqual({ id: 'automation.updated' })
    expect(fetchMock).toHaveBeenCalledWith(
      `${HA_URL}/api/config/automation/config/automation.existing`,
      expect.objectContaining({
        method: 'POST',
      })
    )

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.id).toBe('automation.existing')
  })

  it('uses create endpoint when existingId is null even if payload contains an id', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValue(createJsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    const result = await saveAutomation(HA_URL, TOKEN, {
      ...BASE_AUTOMATION,
      id: 'automation.candidate',
    })

    expect(result).toEqual({ id: 'automation.candidate' })
    expect(fetchMock).toHaveBeenCalledWith(
      `${HA_URL}/api/config/automation/config`,
      expect.objectContaining({
        method: 'POST',
      })
    )
  })

  it('throws typed HASaveError on validation rejection', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValue(
      createJsonResponse({ message: 'Invalid service name' }, 400)
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      saveAutomation(HA_URL, TOKEN, BASE_AUTOMATION)
    ).rejects.toMatchObject({
      name: 'HASaveError',
      code: 'VALIDATION',
      haMessage: 'Invalid service name',
    })
  })
})

describe('listAutomations', () => {
  it('returns automation summaries filtered from /api/states', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValue(
      createJsonResponse([
        {
          entity_id: 'automation.morning_routine',
          state: 'on',
          attributes: { friendly_name: 'Morning routine', id: '12345' },
        },
        {
          entity_id: 'light.kitchen',
          state: 'off',
          attributes: { friendly_name: 'Kitchen light', id: '67890' },
        },
        {
          entity_id: 'automation.night_mode',
          state: 'unknown',
          attributes: { id: '54321' },
        },
      ])
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await listAutomations(HA_URL, TOKEN)

    expect(fetchMock).toHaveBeenCalledWith(
      `${HA_URL}/api/states`,
      expect.objectContaining({
        method: 'GET',
      })
    )
    expect(result).toEqual([
      {
        id: '12345',
        alias: 'Morning routine',
        state: 'on',
      },
      {
        id: '54321',
        alias: 'automation.night_mode',
        state: 'unavailable',
      },
    ])
  })
})

describe('getAutomationConfig', () => {
  it('loads and returns automation YAML from the config endpoint', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValue(
      createJsonResponse({
        id: '12345',
        alias: 'Imported automation',
        mode: 'queued',
        triggers: [{ platform: 'state', entity_id: 'light.kitchen', to: 'on' }],
        conditions: [{ condition: 'time', after: '18:00:00' }],
        actions: [{ service: 'light.turn_on' }],
        trace: { stored_traces: 5 },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await getAutomationConfig(
      HA_URL,
      TOKEN,
      '12345'
    )

    expect(fetchMock).toHaveBeenCalledWith(
      `${HA_URL}/api/config/automation/config/12345`,
      expect.objectContaining({
        method: 'GET',
      })
    )
    expect(result).toEqual({
      id: '12345',
      alias: 'Imported automation',
      mode: 'queued',
      triggers: [{ platform: 'state', entity_id: 'light.kitchen', to: 'on' }],
      conditions: [{ condition: 'time', after: '18:00:00' }],
      actions: [{ service: 'light.turn_on' }],
      trace: { stored_traces: 5 },
    })
  })

  it('throws HANotFoundError when requested automation is missing', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValue(createJsonResponse({ message: 'missing' }, 404))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      getAutomationConfig(HA_URL, TOKEN, 'automation.unknown')
    ).rejects.toBeInstanceOf(HANotFoundError)
  })
})

describe('validateAutomationConfig', () => {
  it('sends validate_config command and returns normalized sections', async () => {
    const conn = {
      sendMessagePromise: vi.fn().mockResolvedValue({
        triggers: { valid: true, error: null },
        actions: { valid: false, error: 'Unknown service' },
      }),
    } as unknown as Connection

    const result = await validateAutomationConfig(conn, {
      triggers: BASE_AUTOMATION.triggers,
      actions: BASE_AUTOMATION.actions,
    })

    expect(conn.sendMessagePromise).toHaveBeenCalledWith({
      type: 'validate_config',
      triggers: BASE_AUTOMATION.triggers,
      actions: BASE_AUTOMATION.actions,
    })
    expect(result).toEqual({
      triggers: { valid: true, error: null },
      conditions: { valid: true, error: null },
      actions: { valid: false, error: 'Unknown service' },
    })
  })
})

describe('deleteAutomation', () => {
  it('throws HANotFoundError when automation id is not found', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValue(createJsonResponse({ message: 'missing' }, 404))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      deleteAutomation(HA_URL, TOKEN, 'automation.unknown')
    ).rejects.toBeInstanceOf(HANotFoundError)
  })
})
