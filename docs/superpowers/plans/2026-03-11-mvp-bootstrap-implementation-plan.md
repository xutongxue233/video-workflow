# 3D Print Video MVP Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable MVP backend skeleton for the 3D print promo video platform using Next.js + SQLite + Redis/BullMQ + Worker, aligned with the confirmed tech-selection spec.

**Architecture:** Keep web/API and render worker as separate Node processes in one repo. Use Prisma + SQLite for business data and BullMQ + Redis for async render jobs. Keep media rendering as a placeholder pipeline with clean interfaces so we can swap in full Remotion/FFmpeg logic incrementally.

**Tech Stack:** Next.js 15, TypeScript, Prisma, SQLite, BullMQ, Redis (ioredis), Zod, Vitest.

---

## Chunk 1: Project Bootstrap and Tooling

### Task 1: Scaffold Next.js App and Core Dependencies

**Files:**
- Create: `package.json` and default Next.js scaffold files
- Create: `src/worker/render-worker.ts`
- Create: `.env.example`
- Modify: `package.json` scripts for worker and tests

- [ ] **Step 1: Scaffold app skeleton (configuration/generation step)**

Run: `npx create-next-app@latest . --ts --eslint --tailwind --app --src-dir --import-alias "@/*" --use-npm --yes`
Expected: Next.js app files generated in workspace root.

- [ ] **Step 2: Install runtime dependencies**

Run: `npm install @prisma/client prisma bullmq ioredis zod pino`
Expected: dependencies installed successfully.

- [ ] **Step 3: Install test/runtime utility dependencies**

Run: `npm install -D vitest @vitest/coverage-v8 tsx`
Expected: dev dependencies installed successfully.

- [ ] **Step 4: Configure scripts**

Add scripts:
- `test`: `vitest run`
- `test:watch`: `vitest`
- `worker`: `tsx src/worker/render-worker.ts`
- `db:generate`: `prisma generate`
- `db:migrate`: `prisma migrate dev`

- [ ] **Step 5: Add env template**

Create `.env.example` with:
- `DATABASE_URL="file:./prisma/dev.db"`
- `REDIS_URL="redis://127.0.0.1:6379"`

## Chunk 2: Domain and Queue with TDD

### Task 2: Render Job Domain Contracts (Test First)

**Files:**
- Create: `src/lib/render/render-job.types.ts`
- Create: `src/lib/render/render-job.ts`
- Test: `src/lib/render/render-job.test.ts`

- [ ] **Step 1: Write failing tests for payload validation and idempotency key generation**

```ts
import { describe, expect, it } from 'vitest';
import { buildRenderPayload, buildRenderJobIdempotencyKey } from './render-job';

describe('render-job domain', () => {
  it('builds normalized render payload from user input', () => {
    const payload = buildRenderPayload({
      projectId: 'proj_1',
      templateId: 'tpl_a',
      scriptId: 'scr_1',
      voiceStyle: 'energetic',
      aspectRatio: '9:16',
    });

    expect(payload.projectId).toBe('proj_1');
    expect(payload.templateId).toBe('tpl_a');
    expect(payload.aspectRatio).toBe('9:16');
  });

  it('generates deterministic idempotency key for same payload', () => {
    const input = {
      projectId: 'proj_1',
      templateId: 'tpl_a',
      scriptId: 'scr_1',
      voiceStyle: 'energetic',
      aspectRatio: '9:16' as const,
    };

    expect(buildRenderJobIdempotencyKey(input)).toBe(buildRenderJobIdempotencyKey(input));
  });
});
```

- [ ] **Step 2: Run test to verify RED state**

Run: `npm run test -- src/lib/render/render-job.test.ts`
Expected: FAIL due missing modules/functions.

- [ ] **Step 3: Implement minimal domain code**

Implement `zod` schema + payload builder + deterministic idempotency key.

- [ ] **Step 4: Run test to verify GREEN state**

Run: `npm run test -- src/lib/render/render-job.test.ts`
Expected: PASS.

### Task 3: Queue Abstraction (Test First)

**Files:**
- Create: `src/lib/queue/queue.constants.ts`
- Create: `src/lib/queue/redis.ts`
- Create: `src/lib/queue/render-queue.ts`
- Test: `src/lib/queue/render-queue.test.ts`

- [ ] **Step 1: Write failing tests for job option mapping (pure function)**

Test `buildRenderQueueJobOptions` returns expected `jobId`, `attempts`, and backoff config.

- [ ] **Step 2: Verify RED**

Run: `npm run test -- src/lib/queue/render-queue.test.ts`
Expected: FAIL due missing function.

- [ ] **Step 3: Implement queue module minimal code**

Implement constants + pure options builder + queue producer function signature.

- [ ] **Step 4: Verify GREEN**

Run: `npm run test -- src/lib/queue/render-queue.test.ts`
Expected: PASS.

## Chunk 3: Persistence and API

### Task 4: Prisma Schema and Client

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db/prisma.ts`
- Create: `prisma/seed.ts` (optional starter)

- [ ] **Step 1: Write failing compile-time usage test for client module import**

Test file imports `prisma` client singleton and verifies module exports defined object.

- [ ] **Step 2: Verify RED**

Run: `npm run test -- src/lib/db/prisma.test.ts`
Expected: FAIL due missing module.

- [ ] **Step 3: Implement minimal Prisma schema and client singleton**

Include models: `User`, `Team`, `TeamMember`, `Project`, `Asset`, `Script`, `RenderJob`, `Video`.

- [ ] **Step 4: Generate Prisma client and verify test GREEN**

Run:
- `npm run db:generate`
- `npm run test -- src/lib/db/prisma.test.ts`
Expected: PASS.

### Task 5: Render Job Service and API Routes (Test First)

**Files:**
- Create: `src/lib/render/render-job.service.ts`
- Create: `src/lib/render/render-job.service.test.ts`
- Create: `src/app/api/render-jobs/route.ts`
- Create: `src/app/api/render-jobs/[id]/route.ts`

- [ ] **Step 1: Write failing service tests with mocked repository/queue ports**

Cover:
- creates DB record with `queued`
- enqueues queue job with idempotency key
- returns job DTO

- [ ] **Step 2: Verify RED**

Run: `npm run test -- src/lib/render/render-job.service.test.ts`
Expected: FAIL due missing service.

- [ ] **Step 3: Implement minimal service + API handlers**

Implement dependency-injected service and Next.js route handlers using it.

- [ ] **Step 4: Verify GREEN**

Run: `npm run test -- src/lib/render/render-job.service.test.ts`
Expected: PASS.

## Chunk 4: Worker and End-to-End Verification

### Task 6: Render Worker Skeleton (Test First)

**Files:**
- Modify: `src/worker/render-worker.ts`
- Create: `src/lib/media/render-pipeline.ts`
- Test: `src/lib/media/render-pipeline.test.ts`

- [ ] **Step 1: Write failing tests for `buildOutputVideoPath` and placeholder pipeline result**

- [ ] **Step 2: Verify RED**

Run: `npm run test -- src/lib/media/render-pipeline.test.ts`
Expected: FAIL due missing implementation.

- [ ] **Step 3: Implement minimal pipeline + worker processing logic**

Worker flow: receive queue job -> mark running -> call pipeline -> mark succeeded/failed.

- [ ] **Step 4: Verify GREEN**

Run: `npm run test -- src/lib/media/render-pipeline.test.ts`
Expected: PASS.

### Task 7: Integration Verification and Runbook

**Files:**
- Create: `README.md`
- Modify: `.env.example`

- [ ] **Step 1: Run full test suite**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 2: Run quality checks**

Run:
- `npm run lint`
- `npm run build`
Expected: pass without errors.

- [ ] **Step 3: Add run instructions**

Document commands:
- web: `npm run dev`
- worker: `npm run worker`
- migrate/generate
- local Redis startup example

- [ ] **Step 4: Final verification snapshot**

Capture exact command outcomes in final report.
