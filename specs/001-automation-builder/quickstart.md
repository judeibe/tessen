# Quickstart: Automation Builder

**Feature**: 001-automation-builder | **Branch**: `001-automation-builder`

This guide covers local development setup for the Tessen Automation Builder.

Need a quick way to inspect Home Assistant screens? Use the public demo:
[https://demo.home-assistant.io](https://demo.home-assistant.io) (read-only).

## Prerequisites

| Tool | Minimum Version | Install |
|------|----------------|---------|
| Node.js | 20 LTS | [nodejs.org](https://nodejs.org) |
| pnpm | 9.x | `npm install -g pnpm` |
| A running Home Assistant instance | Any recent version | [home-assistant.io](https://www.home-assistant.io) |

## 1. Clone and install

```bash
git clone https://github.com/judeibe/tessen.git
cd tessen
git checkout 001-automation-builder
pnpm install
```

## 2. Configure your Home Assistant connection

Create a `.env.local` file at the project root:

```bash
# Your Home Assistant base URL (no trailing slash)
VITE_HA_URL=http://homeassistant.local:8123

# Long-Lived Access Token from HA → Profile → Long-Lived Access Tokens
VITE_HA_TOKEN=your_token_here
```

You can also copy the checked-in template and fill it in:

```bash
cp .env.local.example .env.local
```

> **Note**: `.env.local` is git-ignored. Never commit credentials.

To generate a Long-Lived Access Token in Home Assistant:
1. Open HA → click your username (bottom left)
2. Scroll to **Long-lived access tokens**
3. Click **Create token**, name it `tessen-dev`, copy the value

## 3. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173).

## 4. Run tests

```bash
# Unit + integration tests
pnpm test

# Watch mode during development
pnpm test:watch

# With coverage report
pnpm test:coverage
```

## 5. Type check and lint

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # ESLint + Prettier check
pnpm lint:fix    # Auto-fix lint issues
```

## 6. Build for production

```bash
pnpm build
pnpm preview    # Preview the production build locally
```

## Project Layout

```
src/
├── components/     # React UI — rendering only (no HA calls, no flow logic)
├── flows/          # react-flow graph logic — validation, serialization, store
├── ha/             # Home Assistant API client — WebSocket + REST
└── shared/         # Shared TypeScript types and constants

specs/
└── 001-automation-builder/
    ├── plan.md          # Implementation plan (this feature)
    ├── research.md      # Technology decisions
    ├── data-model.md    # Type definitions and data model
    ├── contracts/       # API and component contracts
    └── tasks.md         # Ordered implementation tasks
```

## Key Architecture Rules

1. **UI layer** (`src/components/`) renders and handles user events only.
   It MUST NOT import from `src/ha/` or call HA APIs directly.
2. **Flow layer** (`src/flows/`) manages graph state and serialization.
   It MUST NOT import from `src/components/` or `src/ha/`.
3. **HA layer** (`src/ha/`) handles all HA communication.
   It MUST NOT import from `src/components/`.
4. Cross-layer dependencies flow **downward only**: UI → flows or ha, never the reverse.
5. Shared types live in `src/shared/types.ts`.

Violations of these rules will fail CI.

## Running Against a Mock HA (no real HA instance)

A WireMock or MSW mock server setup is planned as a follow-on task. For now,
connect to a real HA instance. See [Home Assistant Demo](https://demo.home-assistant.io)
for a publicly accessible HA instance (read-only, saves will fail).

## Current Home Assistant API limitation

Importing and updating automations currently supports automations defined in
`automations.yaml` via Home Assistant's automation config endpoints.

## Contributing

See `CONTRIBUTING.md` at the project root. All PRs must:
- Pass `pnpm lint`, `pnpm typecheck`, and `pnpm test`
- Include tests for any new logic in `src/flows/` or `src/ha/`
- Add accessibility assertions for any new UI components
