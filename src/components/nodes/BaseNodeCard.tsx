import type { CSSProperties, ReactNode } from 'react'

import type { FlowNodeType } from '../../shared/types'

interface BaseNodeCardProps {
  nodeType: FlowNodeType
  label: string
  selected: boolean
  hasWarning: boolean
  warningMessage?: string
  children?: ReactNode
}

const nodeTypeStyles: Record<
  FlowNodeType,
  { label: string; badgeBackground: string; badgeText: string; border: string }
> = {
  trigger: {
    label: 'Trigger',
    badgeBackground: '#dbeafe',
    badgeText: '#1e3a8a',
    border: '#60a5fa',
  },
  condition: {
    label: 'Condition',
    badgeBackground: '#fef3c7',
    badgeText: '#92400e',
    border: '#f59e0b',
  },
  action: {
    label: 'Action',
    badgeBackground: '#dcfce7',
    badgeText: '#166534',
    border: '#4ade80',
  },
}

const cardBaseStyle: CSSProperties = {
  minWidth: 220,
  borderRadius: 10,
  border: '2px solid transparent',
  backgroundColor: '#ffffff',
  boxSizing: 'border-box',
}

const cardBodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: 12,
  alignItems: 'flex-start',
  textAlign: 'left',
}

const badgeStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  borderRadius: 999,
  padding: '2px 10px',
  letterSpacing: 0.4,
}

const labelRowStyle: CSSProperties = {
  width: '100%',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
}

const labelStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#0f172a',
  margin: 0,
  overflowWrap: 'anywhere',
}

const warningStyle: CSSProperties = {
  fontSize: 16,
  lineHeight: 1,
}

export function BaseNodeCard({
  nodeType,
  label,
  selected,
  hasWarning,
  warningMessage,
  children,
}: BaseNodeCardProps) {
  const styleConfig = nodeTypeStyles[nodeType]
  const cardStyle: CSSProperties = {
    ...cardBaseStyle,
    borderColor: selected ? styleConfig.border : '#d1d5db',
    borderStyle: selected ? 'solid' : 'dashed',
    boxShadow: selected ? '0 0 0 3px rgba(59, 130, 246, 0.35)' : 'none',
  }

  return (
    <div
      style={cardStyle}
      role="group"
      aria-label={`${styleConfig.label} node: ${label}`}
    >
      <div style={cardBodyStyle}>
        <span
          style={{
            ...badgeStyle,
            backgroundColor: styleConfig.badgeBackground,
            color: styleConfig.badgeText,
          }}
        >
          {styleConfig.label}
        </span>

        <div style={labelRowStyle}>
          <p style={labelStyle}>{label}</p>
          {hasWarning ? (
            <span
              role="img"
              aria-label={warningMessage ?? 'Node has a warning'}
              style={warningStyle}
            >
              ⚠️
            </span>
          ) : null}
        </div>

        {children}
      </div>
    </div>
  )
}
