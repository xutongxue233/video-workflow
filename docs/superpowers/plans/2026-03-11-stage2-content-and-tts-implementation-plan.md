# Stage 2 Content and TTS Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add MVP Stage 2 capabilities: image asset upload, script editing APIs, and a pluggable TTS provider service.

**Architecture:** Keep API handlers thin and put behavior in small service modules. Use local storage adapter for files and Prisma repositories for persistence. TTS uses provider interface + mock implementation so real cloud provider can be swapped in later.

**Tech Stack:** Next.js Route Handlers, Prisma, Zod, Node fs/path, Vitest.

---

## Chunk 1: Assets Upload

### Task 1: Storage Adapter + Asset Service (TDD)

**Files:**
- Create: `src/lib/storage/local-storage.ts`
- Create: `src/lib/storage/local-storage.test.ts`
- Create: `src/lib/assets/asset.service.ts`
- Create: `src/lib/assets/asset.service.test.ts`

- [ ] Write failing tests for local file path generation and write behavior.
- [ ] Verify RED via `npm run test -- src/lib/storage/local-storage.test.ts`.
- [ ] Implement minimal local storage adapter.
- [ ] Verify GREEN.
- [ ] Write failing tests for asset service create flow.
- [ ] Verify RED.
- [ ] Implement minimal asset service.
- [ ] Verify GREEN.

### Task 2: Asset API Route

**Files:**
- Create: `src/app/api/assets/route.ts`

- [ ] Implement multipart `POST /api/assets` using asset service.
- [ ] Return `201` on success, `400` on invalid payload, `500` on server error.

## Chunk 2: Scripts Editing

### Task 3: Script Service (TDD)

**Files:**
- Create: `src/lib/scripts/script.service.ts`
- Create: `src/lib/scripts/script.service.test.ts`

- [ ] Write failing tests for create and update behaviors.
- [ ] Verify RED via `npm run test -- src/lib/scripts/script.service.test.ts`.
- [ ] Implement minimal script service with repository ports.
- [ ] Verify GREEN.

### Task 4: Script API Routes

**Files:**
- Create: `src/app/api/scripts/route.ts`
- Create: `src/app/api/scripts/[id]/route.ts`

- [ ] Implement `POST /api/scripts`.
- [ ] Implement `PATCH /api/scripts/[id]`.
- [ ] Map service errors to HTTP responses.

## Chunk 3: TTS Provider Layer

### Task 5: TTS Provider + Service (TDD)

**Files:**
- Create: `src/lib/tts/tts.types.ts`
- Create: `src/lib/tts/providers/mock-tts.provider.ts`
- Create: `src/lib/tts/tts.service.ts`
- Create: `src/lib/tts/tts.service.test.ts`

- [ ] Write failing tests for TTS request validation and provider result mapping.
- [ ] Verify RED via `npm run test -- src/lib/tts/tts.service.test.ts`.
- [ ] Implement provider interface and mock provider.
- [ ] Implement TTS service.
- [ ] Verify GREEN.

### Task 6: TTS API Route

**Files:**
- Create: `src/app/api/tts/route.ts`

- [ ] Implement `POST /api/tts` to synthesize voiceover via service.

## Chunk 4: Verification and Docs

### Task 7: Final checks

**Files:**
- Modify: `README.md`

- [ ] Run `npm run test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Update README with new API routes and example payloads.
