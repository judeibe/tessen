import type { AutomationMode, FlowNodeType } from './types'

export const NODE_TYPES: readonly FlowNodeType[] = [
  'trigger',
  'condition',
  'action',
]

export const TRIGGER_PLATFORMS = [
  'state',
  'time',
  'numeric_state',
  'event',
  'sun',
  'time_pattern',
  'template',
  'mqtt',
  'zone',
  'webhook',
  'homeassistant',
] as const

export const CONDITION_TYPES = [
  'state',
  'numeric_state',
  'time',
  'sun',
  'template',
  'zone',
  'trigger',
  'and',
  'or',
  'not',
] as const

export const ACTION_TYPES = [
  'call-service',
  'delay',
  'wait_template',
  'wait_for_trigger',
  'choose',
  'if',
  'repeat',
  'stop',
  'fire_event',
  'set_conversation_response',
] as const

export const DEFAULT_AUTOMATION_MODE: AutomationMode = 'single'
