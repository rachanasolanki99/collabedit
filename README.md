# CollabEdit

A **local-first, real-time collaborative document editor** — Google-Docs-style multi-user editing built on CRDTs, with offline support, roles & sharing, version history, and optional AI features.

> 📖 **Full run/verify guide:** [RUN_AND_TEST.md](./RUN_AND_TEST.md) · 🚀 **Deploy guide:** [DEPLOYMENT.md](./DEPLOYMENT.md)

## Features

- **Local-first sync** — the Yjs document lives in the browser (IndexedDB) as the source of truth. Keep typing fully offline; edits queue and reconcile automatically on reconnect via CRDT state-vector diffing. No overwrites, no data loss.
- **Real-time collaboration** — live cursors, presence, and instant edit propagation over a standalone WebSocket sync server that persists an append-only Yjs update log to Postgres.
- **Auth & roles** — email/password auth (Auth.js v5, bcrypt, JWT sessions). `OWNER ⊃ EDITOR ⊃ VIEWER` roles enforced at a single ORM choke-point (`requireRole()`), in the UI (read-only editor for viewers), and again at the WebSocket server.
- **Sharing** — owners invite members by email and assign roles; short-lived signed room tokens bind a user + role to one document per socket.
- **Version history** — named snapshots with time-travel restore.
- **AI (optional)** — Gemini-powered summarize & diff endpoints, rate-limited, gracefully disabled (HTTP 503) when no API key is configured.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Prisma + PostgreSQL · Auth.js v5 · Yjs + y-websocket · TipTap · Tailwind CSS 4 · Google Gemini

## Quick start

Prereqs: Node 24+, Docker (for local Postgres).

```bash
# 1. Postgres on port 5433
docker run -d --name collabedit-pg \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=collabedit \
  -p 5433:5432 postgres:16-alpine

# 2. Environment
cp .env.example .env   # then fill in values (see RUN_AND_TEST.md §3.2 for local defaults)

# 3. Install, migrate, seed demo data
npm install
npx prisma migrate deploy
npm run db:seed

# 4. Run (Next.js app + WebSocket sync server together)
npm run dev
```

Open <http://localhost:3000> and log in with the seeded demo accounts (both password `password123`):

| Account | Role |
|---|---|
| `alice@demo.dev` | OWNER of "Welcome to CollabEdit" |
| `bob@demo.dev` | VIEWER on Alice's document |

Log in as Alice in one browser and Bob in another (or incognito) to see live collaboration and role enforcement.

## Tests

```bash
npm test              # unit (Vitest): CRDT merge, roles, sync tokens, validation
npm run typecheck     # TypeScript
npm run lint          # ESLint
npm run test:e2e      # Playwright: roles, offline sync, live collab, version history
```

CI (GitHub Actions) runs lint, typecheck, unit tests, production build, and the full Playwright E2E suite against a real Postgres.

## Project layout

```
src/app/                 App Router pages + API routes (documents, members, versions, token, ai, auth)
src/components/editor/   TipTap editor, presence, toolbar, share & version panels
src/lib/                 auth, authz, roles, prisma, validation, sync tokens, collab hooks
server/                  ws-server.ts (Yjs relay) + persistence.ts (Postgres update log)
prisma/                  schema, migrations, seed, optional rls.sql
tests/                   unit (Vitest) + e2e (Playwright)
```

## Architecture notes

- **Why a separate WS server?** Vercel's serverless runtime can't hold WebSocket connections, so the sync relay ships as a small container (`Dockerfile.ws`) deployable to Railway/Render/Fly, sharing the same Postgres and a signed-token secret with the app.
- **Authorization model** — every document-scoped query goes through `requireRole()` in `src/lib/authz.ts`, which filters by membership row. Optional Postgres Row-Level Security (`prisma/rls.sql`) is included as documented defense-in-depth.
- **Persistence model** — the WS server appends compacted Yjs updates to `doc_updates`; snapshots (`versions`) store full document state for O(1) restore.
