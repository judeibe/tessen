import {
  getServices,
  type Connection,
  type HassService,
  type HassServices,
} from 'home-assistant-js-websocket'

import type { HAService, HAServiceField } from '../shared/types'

function mapServiceFields(fields: HassService['fields']): Record<string, HAServiceField> {
  return Object.fromEntries(
    Object.entries(fields ?? {}).map(([fieldName, field]) => [
      fieldName,
      {
        name: field.name,
        description: field.description,
        required: field.required,
        selector:
          typeof field.selector === 'object' && field.selector !== null
            ? (field.selector as Record<string, unknown>)
            : undefined,
        default: field.default,
      },
    ]),
  )
}

function mapServices(services: HassServices): HAService[] {
  const mapped: HAService[] = []

  for (const [domain, domainServices] of Object.entries(services ?? {})) {
    for (const [service, definition] of Object.entries(domainServices ?? {})) {
      mapped.push({
        domain,
        service,
        name: definition.name,
        description: definition.description,
        fields: mapServiceFields(definition.fields),
      })
    }
  }

  mapped.sort((left, right) => {
    const domainCompare = left.domain.localeCompare(right.domain)
    if (domainCompare !== 0) {
      return domainCompare
    }
    return left.service.localeCompare(right.service)
  })

  return mapped
}

export async function getAllServices(conn: Connection): Promise<HAService[]> {
  try {
    const services = await getServices(conn)
    return mapServices(services)
  } catch (error) {
    throw new Error('Failed to fetch Home Assistant services.', { cause: error })
  }
}
