# video-workflow

MVP skeleton for a 3D printing promo video generation platform.

## Stack

- Next.js 16 + TypeScript
- Prisma + SQLite
- Redis + BullMQ
- Vitest
- Zod

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env file:

```bash
cp .env.example .env
```

3. Create and apply database migrations:

```bash
npx prisma migrate dev --skip-seed
npm run db:generate
```

4. Start Redis locally (example with Docker):

```bash
docker run --name video-workflow-redis -p 6379:6379 -d redis:7
```

## Environment Variables

Required for core runtime:

- `DATABASE_URL` (SQLite path)
- `REDIS_URL`
- `LOCAL_STORAGE_ROOT`

Required for AI script generation (OpenAI-compatible endpoint):

- `OPENAI_COMPAT_BASE_URL`
- `OPENAI_COMPAT_API_KEY`
- `OPENAI_SCRIPT_MODEL`

Required for SeaDance video generation:

- `SEADANCE_BASE_URL`
- `SEADANCE_API_KEY`
- `SEADANCE_VIDEO_MODEL`

Optional worker tuning:

- `SEADANCE_POLL_INTERVAL_MS` (default `2000`)
- `SEADANCE_POLL_TIMEOUT_MS` (default `120000`)
- `RENDER_WORKER_CONCURRENCY` (default `1`)
- `DISABLE_RENDER_WORKER_AUTO_START` (set `true` in test/dev scenarios where you do not want auto start)

## Run

Start web app:

```bash
npm run dev
```

Start render worker (new terminal):

```bash
npm run worker
```

## Tests and Quality

```bash
npm run test
npm run lint
npm run build
```

## Current Scope

Implemented in Stage 1 + Stage 2 + OpenAI/SeaDance generation chain:

- Render job domain validation and idempotency key generation
- BullMQ queue setup and enqueue abstraction
- Prisma schema for users, teams, projects, assets, scripts, render jobs, and videos
- Render job service + repository with provider/external status fields
- Local storage adapter for generated/media files
- Script create/update service
- OpenAI-compatible script/storyboard generation service
- SeaDance async video generation service (create job + polling)
- Render worker integration for SeaDance external jobs and video record write-back
- TTS provider abstraction with mock provider
- API routes:
  - `GET /api/files/[...storageKey]`
  - `POST /api/assets`
  - `POST /api/scripts`
  - `GET /api/scripts/[id]`
  - `PATCH /api/scripts/[id]`
  - `POST /api/ai/scripts/generate`
  - `POST /api/videos/generate`
  - `POST /api/tts`
  - `POST /api/render-jobs`
  - `GET /api/render-jobs/[id]`
- Home page (`/`) workbench for upload, script generation/editing, TTS, and video queue actions

## API Examples

Generate script and storyboard (OpenAI-compatible):

```bash
curl -X POST http://localhost:3000/api/ai/scripts/generate \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_123",
    "productName": "Miniature Dragon",
    "sellingPoints": ["high detail", "easy support removal"],
    "targetAudience": "tabletop gamers",
    "tone": "energetic",
    "durationSec": 30
  }'
```

Update script text/storyboard fields:

```bash
curl -X PATCH http://localhost:3000/api/scripts/scr_123 \
  -H "Content-Type: application/json" \
  -d '{
    "hook": "Print faster with better detail",
    "storyboard": "1. Model reveal | Crisp details | Dolly in",
    "cta": "Try it now"
  }'
```

Queue SeaDance video generation:

```bash
curl -X POST http://localhost:3000/api/videos/generate \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_123",
    "scriptId": "scr_123",
    "aspectRatio": "9:16",
    "voiceStyle": "energetic"
  }'
```

Generate TTS voiceover:

```bash
curl -X POST http://localhost:3000/api/tts \
  -H "Content-Type: application/json" \
  -d '{
    "scriptText": "Meet the easiest way to showcase your 3D model.",
    "voiceStyle": "energetic"
  }'
```

Fetch stored file (example):

```bash
curl http://localhost:3000/api/files/assets/example.png --output example.png
```

## Notes

- SQLite is intentionally used for MVP speed. For scaling, migrate to PostgreSQL.
- `src/lib/tts/providers/mock-tts.provider.ts` is a development placeholder and should be replaced in production.
