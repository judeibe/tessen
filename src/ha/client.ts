import {
  ERR_CANNOT_CONNECT,
  ERR_CONNECTION_LOST,
  ERR_INVALID_AUTH,
  createConnection,
  createLongLivedTokenAuth,
  type Connection,
} from 'home-assistant-js-websocket'

type HAConnectionErrorCode =
  | 'CANNOT_CONNECT'
  | 'INVALID_AUTH'
  | 'CONNECTION_LOST'

type HASaveErrorCode = 'NETWORK' | 'VALIDATION' | 'SIZE_LIMIT'

export class HAConnectionError extends Error {
  code: HAConnectionErrorCode

  constructor(code: HAConnectionErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'HAConnectionError'
    this.code = code
  }
}

export class HASaveError extends Error {
  code: HASaveErrorCode
  haMessage?: string

  constructor(
    code: HASaveErrorCode,
    message: string,
    haMessage?: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'HASaveError'
    this.code = code
    this.haMessage = haMessage
  }
}

export class HANotFoundError extends Error {
  automationId: string

  constructor(automationId: string, options?: ErrorOptions) {
    super(`Automation '${automationId}' was not found.`, options)
    this.name = 'HANotFoundError'
    this.automationId = automationId
  }
}

function normalizeHAErrorCode(error: unknown): number | null {
  if (typeof error === 'number') {
    return error
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'number'
  ) {
    return (error as { code: number }).code
  }

  return null
}

export async function connectToHA(
  haUrl: string,
  token: string,
): Promise<Connection> {
  try {
    const auth = createLongLivedTokenAuth(haUrl, token)
    return await createConnection({ auth })
  } catch (error) {
    const code = normalizeHAErrorCode(error)

    if (code === ERR_CANNOT_CONNECT) {
      throw new HAConnectionError(
        'CANNOT_CONNECT',
        'Unable to connect to Home Assistant.',
        { cause: error },
      )
    }

    if (code === ERR_INVALID_AUTH) {
      throw new HAConnectionError(
        'INVALID_AUTH',
        'Home Assistant rejected the access token.',
        { cause: error },
      )
    }

    if (code === ERR_CONNECTION_LOST) {
      throw new HAConnectionError(
        'CONNECTION_LOST',
        'Connection to Home Assistant was lost.',
        { cause: error },
      )
    }

    throw new HAConnectionError(
      'CANNOT_CONNECT',
      'Unable to connect to Home Assistant.',
      { cause: error },
    )
  }
}
