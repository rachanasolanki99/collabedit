# Deploying CollabEdit

Three pieces, three free-tier services:

| Piece | Service | Why |
|---|---|---|
| Postgres | [Neon](https://neon.tech) (free) | Serverless Postgres with pooled + direct URLs |
| WebSocket sync server | [Railway](https://railway.app) (or Render/Fly) | Long-lived connections — can't run on Vercel |
| Next.js app | [Vercel](https://vercel.com) (free) | Native Next.js hosting |

Do them **in this order** — each step feeds env vars into the next.

Before starting, generate two secrets (run twice):

```bash
openssl rand -base64 32   # → AUTH_SECRET
openssl rand -base64 32   # → SYNC_JWT_SECRET
```

---

## 1. Database — Neon

1. Create a project at <https://console.neon.tech> (Postgres 16+).
2. From the dashboard copy **both** connection strings:
   - **Pooled** (host contains `-pooler`) → this is `DATABASE_URL`
   - **Direct** (no `-pooler`) → this is `DIRECT_URL`
3. Apply migrations and seed the demo accounts **from your machine**:

```bash
# PowerShell (use the DIRECT url for both here)
$env:DATABASE_URL="postgresql://...direct...?sslmode=require"
$env:DIRECT_URL=$env:DATABASE_URL
npx prisma migrate deploy
npm run db:seed        # creates alice@demo.dev / bob@demo.dev (password123)
```

Seeding gives your interviewer instant demo accounts — mention them in the email/README.

## 2. WebSocket server — Railway

1. Push this repo to GitHub (see step 0 note below if you haven't).
2. In Railway: **New Project → Deploy from GitHub repo**. It picks up `railway.json` automatically (builds `Dockerfile.ws`, health check on `/health`).
3. Set variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon **pooled** URL |
| `DIRECT_URL` | Neon **direct** URL (Prisma client just needs it defined) |
| `SYNC_JWT_SECRET` | secret #2 from above |

4. **Settings → Networking → Generate Domain.** You get e.g. `collabedit-ws-production.up.railway.app`.
5. Verify: `https://<domain>/health` → `ok`. Your sync URL is `wss://<domain>` (note **wss**, no port).

## 3. App — Vercel

1. In Vercel: **Add New → Project → import the GitHub repo.** Framework auto-detects Next.js; the `build` script already runs `prisma generate`.
2. Environment variables (Production):

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon **pooled** URL |
| `DIRECT_URL` | Neon **direct** URL |
| `AUTH_SECRET` | secret #1 |
| `SYNC_JWT_SECRET` | secret #2 — **must match Railway's** |
| `NEXT_PUBLIC_SYNC_URL` | `wss://<your-railway-domain>` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | (optional) Gemini key from <https://aistudio.google.com/apikey> — omit to leave AI features disabled |

3. Deploy. Auth.js v5 trusts the Vercel host automatically — no `AUTH_URL` needed.

## 4. Smoke test the deployed link

1. `https://<app>.vercel.app` loads; log in as `alice@demo.dev` / `password123`.
2. Open the same document as `bob@demo.dev` in an incognito window — typing as Alice shows up live for Bob; Bob's editor is read-only.
3. DevTools → Network → WS: the socket to `wss://<railway-domain>/<docId>?token=…` shows **101 Switching Protocols**.
4. Toggle DevTools offline mode, type, go back online — edits reconcile.

---

**Step 0 (if repo isn't on GitHub yet):**

```bash
git add -A
git commit -m "CollabEdit: local-first collaborative editor"
gh repo create collabedit --private --source . --push   # or create the repo in the GitHub UI and push
```

`.env` is git-ignored — only `.env.example` is committed. Never paste real secrets into the repo.

**Troubleshooting**

- *Login works but the editor never says "Synced"* → `NEXT_PUBLIC_SYNC_URL` is wrong or `SYNC_JWT_SECRET` differs between Vercel and Railway. `NEXT_PUBLIC_*` vars are baked at build time — redeploy the Vercel app after changing it.
- *WS closes immediately with 1008* → token rejected: secrets don't match.
- *Prisma errors on Vercel* → make sure `DIRECT_URL` is set too; the schema requires it.
