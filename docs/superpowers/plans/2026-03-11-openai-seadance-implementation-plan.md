# OpenAI + SeaDance Generation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual placeholder generation with OpenAI-compatible script/storyboard generation and SeaDance async video generation.

**Architecture:** Keep existing render job queue architecture, add two provider services (text + video), and wire them into new APIs and worker flow.

**Tech Stack:** Next.js Route Handlers, Prisma, BullMQ, Vitest, Zod, fetch API.

---

## Chunk 1: Schema and Render Job Model

### Task 1: Extend Prisma schema and migrate

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_model_provider_fields/migration.sql`

- [x] Add Script fields: `structuredJson`, `generatorModel`.
- [x] Add RenderJob fields: `provider`, `externalJobId`, `externalStatus`, `attemptCount`.
- [x] Generate migration and client.

### Task 2: Update render job types/repository

**Files:**
- Modify: `src/lib/render/render-job.types.ts`
- Modify: `src/lib/render/render-job.ts`
- Modify: `src/lib/render/render-job.service.ts`
- Modify: `src/lib/render/render-job.repository.ts`
- Modify tests for render job domain/service

- [x] Include provider/external status fields in DTO and persistence actions.

## Chunk 2: OpenAI Script Generation

### Task 3: TDD for script generation service

**Files:**
- Create: `src/lib/ai/script-generation.service.ts`
- Create: `src/lib/ai/script-generation.service.test.ts`
- Create: `src/lib/ai/openai-compatible.client.ts`

- [x] Write failing tests for valid JSON parse/save and invalid JSON handling.
- [x] Implement minimal service + client adapter.
- [x] Verify tests pass.

### Task 4: Add API endpoint

**Files:**
- Create: `src/app/api/ai/scripts/generate/route.ts`

- [x] Implement `POST /api/ai/scripts/generate` with validation and error mapping.

## Chunk 3: SeaDance Async Video Generation

### Task 5: TDD for SeaDance service

**Files:**
- Create: `src/lib/video/seadance-video.service.ts`
- Create: `src/lib/video/seadance-video.service.test.ts`

- [x] Write failing tests for success, fail, timeout polling flows.
- [x] Implement minimal service.

### Task 6: Worker integration

**Files:**
- Modify: `src/worker/render-worker.ts`
- Create: `src/worker/render-worker.processor.test.ts`

- [x] Update worker to call SeaDance service and write external status/video URL to DB.
- [x] Add failing then passing worker processor tests.

### Task 7: Add videos generate API

**Files:**
- Create: `src/app/api/videos/generate/route.ts`

- [x] Implement queue-creation endpoint for SeaDance video generation.

## Chunk 4: Workbench and Verification

### Task 8: Workbench actions

**Files:**
- Modify: `src/app/page.tsx`

- [x] Add AI script generation button and new video generation call.

### Task 9: Verification

- [x] Run: `npm run test`
- [x] Run: `npm run lint`
- [x] Run: `npm run build`
- [x] Update `README.md` env vars and API examples.
