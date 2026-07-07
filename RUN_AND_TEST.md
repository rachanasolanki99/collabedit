# CollabEdit — Run & Test Guide

A local-first, real-time collaborative document editor built as an interview
task. This document explains what the project is, how to run it locally, and the
results of running its full test/verification suite.

- **Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Prisma + PostgreSQL · NextAuth (Auth.js v5) · Yjs CRDT + `y-websocket` · TipTap editor · Tailwind CSS 4 · Google Gemini (AI features)
- **Verified on:** Windows 11, Node v24.17.0, npm 11.13.0, Docker 29.6.1, on 2026‑07‑07.

---

## 1. What the project does

CollabEdit is a Google‑Docs‑style editor where multiple users edit the same
document simultaneously.

| Area | Highlights |
|------|-----------|
| **Local-first sync** | The Yjs document lives in the browser (IndexedDB) and is the source of truth. You can keep typing fully offline; edits queue and reconcile automatically on reconnect via CRDT state‑vector diffing — no overwrites, no data loss. |
| **Real-time collaboration** | A standalone WebSocket server (`server/ws-server.ts`) relays Yjs updates and awareness (live cursors / presence) between clients and persists an append‑only update log to Postgres. |
| **Auth** | Email/password via NextAuth (Auth.js v5), bcrypt password hashing, JWT sessions. Edge middleware guards all app routes. |
| **Roles & authorization** | `OWNER ⊃ EDITOR ⊃ VIEWER`. A single ORM choke‑point (`requireRole()` in `src/lib/authz.ts`) filters every document‑scoped query by a membership row. Viewers get a read‑only editor; the WS server also refuses writes from viewers. Optional Postgres Row‑Level Security is provided in `prisma/rls.sql` as defense‑in‑depth. |
| **Sharing** | Owners invite members and assign roles; short‑lived signed room tokens (`SYNC_JWT_SECRET`) bind a user+role to a single document for the socket. |
| **Version history** | Named snapshots (`encodeStateAsUpdate`) for time‑travel/restore. |
| **AI (optional)** | Gemini‑powered summarize + diff endpoints (`/api/ai/*`), rate‑limited. Disabled gracefully (HTTP 503) when no API key is set. |
| **Security headers** | HSTS, `X-Frame-Options: DENY`, `nosniff`, referrer + permissions policy in `next.config.ts`. |

---

## 2. Prerequisites

- **Node.js 24+** and **npm**
- **Docker** (for the local Postgres database) — or any reachable PostgreSQL 16 instance

---

## 3. Running locally (the exact steps used to verify it)

### 3.1 Start PostgreSQL

The local `.env` points at Postgres on **port 5433**. Start a container:

```bash
docker run -d --name collabedit-pg \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=collabedit \
  -p 5433:5432 postgres:16-alpine
# already created it once? just: docker start collabedit-pg
```

### 3.2 Environment

A working local `.env` is already checked in (dev‑only secrets). It sets:

```env
DATABASE_URL / DIRECT_URL   -> postgresql://postgres:postgres@localhost:5433/collabedit
AUTH_SECRET                 -> dev-only secret
NEXT_PUBLIC_SYNC_URL        -> ws://localhost:1234
SYNC_JWT_SECRET             -> dev-only sync secret
GOOGLE_GENERATIVE_AI_API_KEY-> "" (empty; AI features stay disabled until set)
```

To enable AI locally, drop a Gemini key from <https://aistudio.google.com/apikey>
into `GOOGLE_GENERATIVE_AI_API_KEY`.

### 3.3 Install, migrate, seed

```bash
npm install
npx prisma generate       # generate the Prisma client
npx prisma migrate deploy # apply migrations
npm run db:seed           # seed demo users + a shared document
```

Seeded demo accounts (both `password123`):

- `alice@demo.dev` — **OWNER** of "Welcome to CollabEdit"
- `bob@demo.dev`   — **VIEWER** on Alice's document

### 3.4 Run the app

```bash
npm run dev
```

This uses `concurrently` to start **both** servers:

- Next.js app → <http://localhost:3000>
- WebSocket sync server → `ws://localhost:1234` (health at <http://localhost:1234/health>)

Open <http://localhost:3000>, log in as Alice in one browser and Bob in another
(or a second profile / incognito window) to see live collaboration + role
enforcement.

---

## 4. Test & verification results

All commands below were run against the setup above.

| Check | Command | Result |
|-------|---------|--------|
| **Unit tests** | `npm test` (Vitest) | ✅ **13/13 passed** (4 files: CRDT merge, roles, sync‑token, validation) |
| **Type check** | `npm run typecheck` | ✅ **Passed** (no errors) |
| **Production build** | `npm run build` | ✅ **Compiled successfully**; 17 routes generated |
| **E2E — roles** | `npx playwright test roles` | ✅ **Passed** (viewer gets read‑only editor, write UI hidden) |
| **E2E — offline sync** | `npx playwright test offline-sync` | ✅ **Passed** (offline edits preserved and reconciled on reconnect; see §5 for a note on cold-run timing) |
| **E2E — live collaboration** | `npx playwright test live-collab` | ✅ **Passed** (edits propagate live in both directions between two connected users) |
| **E2E — version history** | `npx playwright test version-history` | ✅ **Passed** (snapshot captured, later edits discarded on restore) |
| **Lint** | `npm run lint` (ESLint) | ✅ **Passed** — 0 errors, 0 warnings |
| **Runtime smoke** | `curl` | ✅ `/` → 200, `/login` → 200, `/documents` → 307 redirect to `/login` (auth works), WS `/health` → 200 "ok" |

### Reproduce the full suite

```bash
npm test              # unit
npm run typecheck     # types
npm run build         # production build
npm run test:e2e      # Playwright end-to-end (needs Postgres up)
```

> The Playwright config reuses an already‑running `npm run dev` locally, and
> boots its own if none is running.

---

## 5. Known issues / notes

1. **ESLint is clean (fixed 2026‑07‑07).** The former `react-hooks/set-state-in-effect`
   errors were resolved: `use-collab.ts` now resets per‑document state during
   render (React's "storing information from previous renders" pattern) and
   publishes the Yjs doc/provider from a pre‑paint microtask; the share/version
   panels load data on the dialog‑open *event* instead of an effect; the theme
   toggle uses `useSyncExternalStore` for mounted detection. Full suite
   (unit, types, build, E2E) re‑verified green after the change.

2. **Offline‑sync E2E can be timing‑flaky on cold runs.** On a cold first run the reconnect after
   coming back online can take longer than the test's 20 s budget because
   `y-websocket` uses exponential backoff for reconnection; on retry it
   reconnects in ~7 s. CI already mitigates this with `retries: 1`. Not a data
   correctness issue — offline edits are preserved and reconciled; only the
   time‑to‑"synced" occasionally exceeds the assertion timeout.

3. **Windows build lock.** If `npm run dev` (or the WS server) is running,
   `npm run build` can fail with `EPERM … query_engine-windows.dll.node` because
   the running Prisma client holds the engine DLL open. Stop the dev servers
   first, then build.

4. **RLS is optional and off by default.** `prisma/rls.sql` adds database‑level
   tenant isolation but requires the app to set `app.user_id` per request; the
   app currently enforces isolation at the ORM layer (`requireRole`). Enabling
   RLS without wiring `set_config` would return zero rows. Leave it off unless
   that wiring is added.

---

## 6. Project layout (quick map)

```
src/app/                 Next.js App Router (pages + API routes)
  (auth)/                login / register
  documents/             dashboard + /documents/[id] editor
  api/                   documents, members, versions, token, ai, auth, register
src/components/editor/   TipTap editor, presence, toolbar, share & version panels
src/lib/                 auth, authz, roles, prisma, validation, sync-token
  collab/                use-collab hook, CRDT/base64/color helpers
server/                  ws-server.ts (Yjs relay) + persistence.ts (Postgres log)
prisma/                  schema.prisma, migrations, seed.ts, rls.sql
tests/unit/              Vitest (crdt-merge, roles, sync-token, validation)
tests/e2e/               Playwright (roles, offline-sync, live-collab, version-history)
```

---

## 7. Deployment (as configured)

> Step-by-step instructions: see **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

- **App:** deployable to Vercel/any Node host (`npm run build` → `npm start`).
- **WS server:** containerized via `Dockerfile.ws`; `railway.json` targets Railway
  (`npx tsx server/ws-server.ts`, health check `/health`). It needs `DATABASE_URL`
  and `SYNC_JWT_SECRET` (matching the app's).
- **Database:** any PostgreSQL 16 (`.env.example` documents a Neon pooled +
  direct‑URL setup).
