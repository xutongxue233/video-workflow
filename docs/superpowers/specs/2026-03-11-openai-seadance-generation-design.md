# OpenAI + SeaDance 生成链路改造设计

日期：2026-03-11

## 1. 目标

将当前 MVP 生成链路改为：

1. 文案 + 分镜：由 OpenAI 兼容模型生成严格 JSON。
2. 视频生成：由 SeaDance 模型异步任务生成，平台通过本地队列 + 轮询完成状态回写。

## 2. 已确认约束

1. SeaDance 接入方式：OpenAI 兼容接口（`baseURL + apiKey + model`）。
2. 文案/分镜输出：严格 JSON。
3. 视频生成模式：异步任务化（创建任务 -> 轮询状态 -> 回写本地表）。

## 3. 架构方案

推荐“最小改造”方案：

1. 复用现有 `render_jobs + BullMQ + worker`。
2. 新增 OpenAI 兼容文本生成 service。
3. 新增 SeaDance 异步视频 service。
4. 增加两个 API：
   - `POST /api/ai/scripts/generate`
   - `POST /api/videos/generate`

## 4. 数据模型变更

## 4.1 Script

新增字段：

1. `structuredJson String?`
2. `generatorModel String?`

## 4.2 RenderJob

新增字段：

1. `provider String?`
2. `externalJobId String?`
3. `externalStatus String?`
4. `attemptCount Int @default(0)`

## 5. 接口契约

## 5.1 文案分镜生成

`POST /api/ai/scripts/generate`

请求体：

```json
{
  "projectId": "proj_123",
  "productName": "Miniature Dragon",
  "sellingPoints": ["high detail", "easy support removal"],
  "targetAudience": "tabletop gamers",
  "tone": "energetic",
  "durationSec": 30
}
```

返回体：

```json
{
  "scriptId": "scr_xxx",
  "model": "gpt-4.1-mini",
  "structuredJson": { "title": "...", "hook": "...", "voiceover": "...", "cta": "...", "shots": [] }
}
```

## 5.2 视频生成

`POST /api/videos/generate`

请求体：

```json
{
  "projectId": "proj_123",
  "scriptId": "scr_123",
  "aspectRatio": "9:16",
  "voiceStyle": "energetic"
}
```

返回体：

```json
{
  "renderJobId": "job_xxx",
  "status": "QUEUED"
}
```

## 6. Worker 编排

1. 任务开始：`markRunning`
2. 读取脚本（`structuredJson`）并组装视频 prompt
3. 调 SeaDance 创建外部任务，记录 `externalJobId` + `externalStatus`
4. 轮询外部任务
5. 成功：写 `videos` + `markSucceeded`
6. 失败/超时：`markFailed`

## 7. 错误与重试

1. BullMQ 重试：`attempts=3`，指数退避。
2. 可重试错误：网络抖动、5xx、限流。
3. 不重试错误：参数非法、JSON schema 校验失败。
4. 每次重试累加 `attemptCount`。

## 8. 测试策略

1. `script-generation.service.test.ts`
2. `seadance-video.service.test.ts`
3. `render-worker.processor.test.ts`
4. API 入参校验与错误映射覆盖

## 9. 环境变量

1. `OPENAI_COMPAT_BASE_URL`
2. `OPENAI_COMPAT_API_KEY`
3. `OPENAI_SCRIPT_MODEL`
4. `SEADANCE_BASE_URL`
5. `SEADANCE_API_KEY`
6. `SEADANCE_VIDEO_MODEL`
7. `SEADANCE_POLL_INTERVAL_MS`
8. `SEADANCE_POLL_TIMEOUT_MS`
