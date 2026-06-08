import {
  getStates,
  subscribeEntities,
  type Connection,
  type HassEntities,
  type HassEntity,
  type UnsubscribeFunc,
} from 'home-assistant-js-websocket'
import { describe, expect, it, vi } from 'vitest'

import { getAllEntities, subscribeToEntities } from '../entities'

vi.mock('home-assistant-js-websocket', async () => {
  const actual = await vi.importActual<
    typeof import('home-assistant-js-websocket')
  >('home-assistant-js-websocket')

  return {
    ...actual,
    getStates: vi.fn(),
    subscribeEntities: vi.fn(),
  }
})

const createHassEntity = (
  entityId: string,
  state: string,
  attributes: Record<string, unknown>
): HassEntity =>
  ({
    entity_id: entityId,
    state,
    attributes,
  }) as HassEntity

describe('getAllEntities', () => {
  it('maps Home Assistant entities to shared HAEntity shape', async () => {
    vi.mocked(getStates).mockResolvedValue([
      createHassEntity('light.kitchen', 'on', {
        friendly_name: 'Kitchen Light',
        brightness: 180,
      }),
      createHassEntity('sensor.temperature', '21', {}),
    ])

    const entities = await getAllEntities({} as Connection)

    expect(entities).toEqual([
      {
        entity_id: 'light.kitchen',
        state: 'on',
        attributes: {
          friendly_name: 'Kitchen Light',
          brightness: 180,
        },
        friendlyName: 'Kitchen Light',
        domain: 'light',
      },
      {
        entity_id: 'sensor.temperature',
        state: '21',
        attributes: {},
        friendlyName: 'sensor.temperature',
        domain: 'sensor',
      },
    ])
  })
})

describe('subscribeToEntities', () => {
  it('subscribes and maps live entities before invoking callback', () => {
    const unsubscribe = vi.fn() as UnsubscribeFunc
    vi.mocked(subscribeEntities).mockImplementation((_, onChange) => {
      const payload: HassEntities = {
        'switch.fan': createHassEntity('switch.fan', 'off', {}),
      }
      onChange(payload)
      return unsubscribe
    })

    const callback = vi.fn()
    const stop = subscribeToEntities({} as Connection, callback)

    expect(stop).toBe(unsubscribe)
    expect(callback).toHaveBeenCalledWith({
      'switch.fan': {
        entity_id: 'switch.fan',
        state: 'off',
        attributes: {},
        friendlyName: 'switch.fan',
        domain: 'switch',
      },
    })
  })
})
