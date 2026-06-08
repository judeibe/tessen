import {
  getStates,
  subscribeEntities,
  type Connection,
  type HassEntities,
  type HassEntity,
  type UnsubscribeFunc,
} from 'home-assistant-js-websocket'

import type { HAEntity } from '../shared/types'

function mapEntity(entity: HassEntity): HAEntity {
  const attributes =
    typeof entity.attributes === 'object' && entity.attributes !== null
      ? entity.attributes
      : {}
  const domain = entity.entity_id.includes('.')
    ? entity.entity_id.split('.')[0]
    : entity.entity_id
  const friendlyName =
    typeof attributes.friendly_name === 'string'
      ? attributes.friendly_name
      : entity.entity_id

  return {
    entity_id: entity.entity_id,
    state: entity.state,
    attributes,
    friendlyName,
    domain,
  }
}

function mapEntities(entities: HassEntities): Record<string, HAEntity> {
  return Object.fromEntries(
    Object.entries(entities).map(([entityId, entity]) => [
      entityId,
      mapEntity(entity),
    ])
  )
}

export async function getAllEntities(conn: Connection): Promise<HAEntity[]> {
  try {
    const states = await getStates(conn)
    return states.map(mapEntity)
  } catch (error) {
    throw new Error('Failed to fetch Home Assistant entities.', {
      cause: error,
    })
  }
}

export function subscribeToEntities(
  conn: Connection,
  callback: (entities: Record<string, HAEntity>) => void
): UnsubscribeFunc {
  return subscribeEntities(conn, (entities) => {
    callback(mapEntities(entities))
  })
}
