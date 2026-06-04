import type { ReactNode } from 'react'

interface AppLayoutProps {
  header: ReactNode
  palette: ReactNode
  canvas: ReactNode
  configPanel?: ReactNode
  statusAnnouncement?: string
  errorAnnouncement?: string
}

const visuallyHiddenStyle = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  border: 0,
  whiteSpace: 'nowrap',
} as const

export function AppLayout({
  header,
  palette,
  canvas,
  configPanel,
  statusAnnouncement,
  errorAnnouncement,
}: AppLayoutProps) {
  return (
    <div className="app-layout">
      <div style={visuallyHiddenStyle} aria-live="polite" aria-atomic="true">
        {statusAnnouncement ?? ''}
      </div>
      <div style={visuallyHiddenStyle} aria-live="assertive" aria-atomic="true">
        {errorAnnouncement ?? ''}
      </div>

      <header className="app-layout__header">{header}</header>

      <div className="app-layout__body">
        <aside className="app-layout__palette" aria-label="Node palette">
          {palette}
        </aside>

        <main
          className="app-layout__canvas"
          role="main"
          aria-label="Automation canvas"
        >
          {canvas}
        </main>

        <aside
          className="app-layout__config"
          aria-label="Node configuration panel"
        >
          {configPanel}
        </aside>
      </div>
    </div>
  )
}
