# video-workflow

Workflow app for short-video production:

1. Generate material images from a prototype image (Seedream i2i).
2. Manage and apply prompt templates.
3. Generate and edit scripts.
4. Queue video jobs and track render status.

## Stack

- Next.js 16 + TypeScript
- Prisma + SQLite
- Redis + BullMQ
- Zod + Vitest

## Local Setup

1. Install dependencies.

```bash
npm install
```

2. Create local env file (`.env`) from `.env.example`.

3. Run database migration and Prisma client generation.

```bash
npx prisma migrate dev
npx prisma generate
```

4. Start Redis (example with Docker).

```bash
docker run --name video-workflow-redis -p 6379:6379 -d redis:7
```

## Environment Variables

Core:

- `DATABASE_URL`
- `REDIS_URL`
- `LOCAL_STORAGE_ROOT`

Text script generation:

- `OPENAI_COMPAT_BASE_URL`
- `OPENAI_COMPAT_API_KEY`
- `OPENAI_SCRIPT_MODEL`

Image generation (Seedream):

- `SEEDREAM_BASE_URL` (recommended `https://ark.cn-beijing.volces.com/api/v3`)
- `SEEDREAM_API_KEY`
- `SEEDREAM_IMAGE_MODEL` (recommended `doubao-seedream-5.0-lite`)

Video generation (SeaDance):

- `SEADANCE_BASE_URL`
- `SEADANCE_API_KEY`
- `SEADANCE_VIDEO_MODEL`

Worker tuning:

- `VIDEO_POLL_INTERVAL_MS`
- `VIDEO_POLL_TIMEOUT_MS`
- `SEADANCE_POLL_INTERVAL_MS`
- `SEADANCE_POLL_TIMEOUT_MS`
- `RENDER_WORKER_CONCURRENCY`
- `DISABLE_RENDER_WORKER_AUTO_START`
- `FFMPEG_PATH` (optional; empty means using bundled `vendor/ffmpeg` binary first, then fallback to `ffmpeg-static`)

Bundled FFmpeg:

- Windows x64 binary is committed at `vendor/ffmpeg/win32-x64/ffmpeg.exe`.
- License and build metadata are kept in:
  - `vendor/ffmpeg/win32-x64/ffmpeg.exe.LICENSE`
  - `vendor/ffmpeg/win32-x64/ffmpeg.exe.README`

## Run

Start web + worker together:

```bash
npm run dev:all
```

Run separately:

```bash
npm run dev
npm run worker
```

## Main Pages

- `/projects/[projectId]`: full workflow page (materials, scripts, render jobs)
- `/settings`: model provider configuration

## Main API Routes

- `GET /api/workspace/[projectId]/overview`: aggregated workspace payload (project, assets, scripts, render jobs, templates)
- `POST /api/images/generate`: `prototypeAssetId + referenceAssetIds` -> generated material assets
- `GET/POST/DELETE /api/prompt-templates`: prompt template management
- `POST /api/ai/scripts/generate`: script generation
- `POST /api/ai/scripts/autofill`: `referenceAssetIds` -> autofill script inputs
- `POST /api/videos/generate`: queue video generation (`referenceAssetIds` / frame asset ids)
- `GET /api/render-jobs/[id]`: read-only render status
- `POST /api/render-jobs/[id]/reconcile`: explicit reconciliation for timed-out / stuck jobs
- `POST /api/render-jobs/[id]/retry`: retry unfinished shots (`referenceAssetIds`)

## Model Selection Rules

- Video providers using `seedance` should use SeaDance series models.
- Image providers use Seedream/SeedEdit series models.

## Quality Checks

```bash
npm run lint
npm run test
npm run build
```
