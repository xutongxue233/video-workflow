# Model Provider Settings Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a settings flow that lets users configure multiple model providers locally, fetch model lists from `/model/list`, and choose enabled models during script/video generation.

**Architecture:** Keep provider credentials in browser local storage only, add a server-side `/model/list` proxy endpoint for provider model discovery, and pass selected runtime model config from UI to generation APIs. Extend the render queue payload to carry runtime video model config so worker execution can use selected providers without persisting keys in database records.

**Tech Stack:** Next.js App Router, TypeScript, Zod, Prisma, BullMQ, Vitest.

---

## Chunk 1: Shared Contracts + Model List API

### Task 1: Add model/provider contract module

**Files:**
- Create: `src/lib/models/model-provider.types.ts`
- Create: `src/lib/models/model-provider.types.test.ts`

- [ ] **Step 1: Write failing tests for protocol/capability validation and default base URLs**
- [ ] **Step 2: Run `npm test -- src/lib/models/model-provider.types.test.ts` and verify RED**
- [ ] **Step 3: Implement typed capability/protocol contracts + default base URL helpers**
- [ ] **Step 4: Re-run `npm test -- src/lib/models/model-provider.types.test.ts` and verify GREEN**

### Task 2: Implement `/model/list` provider model discovery service

**Files:**
- Create: `src/lib/models/model-list.service.ts`
- Create: `src/lib/models/model-list.service.test.ts`
- Create: `src/app/model/list/route.ts`

- [ ] **Step 1: Write failing tests for OpenAI-compatible and Gemini-compatible model list parsing**
- [ ] **Step 2: Run `npm test -- src/lib/models/model-list.service.test.ts` and verify RED**
- [ ] **Step 3: Implement model list fetch/parsing with protocol-specific HTTP behavior**
- [ ] **Step 4: Add route input validation and error mapping**
- [ ] **Step 5: Re-run `npm test -- src/lib/models/model-list.service.test.ts` and verify GREEN**

## Chunk 2: Runtime Model Selection in Generation APIs

### Task 3: Add Gemini text client and runtime client resolution

**Files:**
- Create: `src/lib/ai/gemini-compatible.client.ts`
- Create: `src/lib/ai/gemini-compatible.client.test.ts`
- Modify: `src/app/api/ai/scripts/generate/route.ts`

- [ ] **Step 1: Write failing tests for Gemini client response parsing and error behavior**
- [ ] **Step 2: Run `npm test -- src/lib/ai/gemini-compatible.client.test.ts` and verify RED**
- [ ] **Step 3: Implement Gemini text completion client matching existing chat client interface**
- [ ] **Step 4: Update script generation route to accept optional runtime text model config**
- [ ] **Step 5: Re-run `npm test -- src/lib/ai/gemini-compatible.client.test.ts` and verify GREEN**

### Task 4: Extend render payload + worker for runtime video model config

**Files:**
- Modify: `src/lib/render/render-job.types.ts`
- Modify: `src/lib/render/render-job.ts`
- Modify: `src/lib/render/render-job.test.ts`
- Modify: `src/app/api/videos/generate/route.ts`
- Create: `src/lib/video/google-video.service.ts`
- Create: `src/lib/video/google-video.service.test.ts`
- Modify: `src/worker/render-worker.ts`
- Modify: `src/worker/render-worker.processor.test.ts`

- [ ] **Step 1: Write failing tests for render payload schema/idempotency with runtime video model config**
- [ ] **Step 2: Run `npm test -- src/lib/render/render-job.test.ts` and verify RED**
- [ ] **Step 3: Implement render payload/runtime config schema changes without persisting apiKey to DB**
- [ ] **Step 4: Write failing tests for Google video service polling status normalization**
- [ ] **Step 5: Run `npm test -- src/lib/video/google-video.service.test.ts` and verify RED**
- [ ] **Step 6: Implement Google protocol video client/service**
- [ ] **Step 7: Update worker to select video service from runtime config (seedance/google)**
- [ ] **Step 8: Update worker processor tests for runtime provider path**
- [ ] **Step 9: Re-run targeted tests and verify GREEN**

## Chunk 3: UI (style-aligned) + Local Model Settings

### Task 5: Build local settings store and settings page

**Files:**
- Create: `src/lib/models/model-settings.local.ts`
- Create: `src/app/settings/page.tsx`

- [ ] **Step 1: Implement browser-safe local storage helpers with shape validation**
- [ ] **Step 2: Build settings UI aligned with existing dashboard visual system**
- [ ] **Step 3: Add provider CRUD, enable/disable, fetch model list, manual model ID fallback**
- [ ] **Step 4: Ensure API keys are stored only in local storage and never sent unless needed**

### Task 6: Integrate model selection into existing workbench

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add lightweight navigation entry to settings page**
- [ ] **Step 2: Load enabled providers from local storage for text/video selectors**
- [ ] **Step 3: Send selected runtime model config in script/video generation requests**
- [ ] **Step 4: Keep visual language and interaction pattern consistent with current page**

## Chunk 4: Verification + Documentation

### Task 7: Update docs and run full verification

**Files:**
- Modify: `README.md`
- Modify: `.env.example` (if protocol defaults need docs)

- [ ] **Step 1: Update README with `/model/list` and local-key behavior**
- [ ] **Step 2: Run `npm run lint`**
- [ ] **Step 3: Run `npm test`**
- [ ] **Step 4: Run `npm run build`**
- [ ] **Step 5: Review diff for accidental key persistence or style regressions**

