# 3D 打印模型宣传短视频生成平台技术选型（确认版）

更新日期：2026-03-11

## 1. 已确认的业务约束

以下内容来自你在本轮沟通中的确认，作为本次选型前提：

1. 目标阶段：MVP 验证期（低并发，先求可用和迭代速度）。
2. 视频生成模式：模板驱动，用户仅编辑文案与分镜说明。
3. 素材输入范围：仅图片 + 文本参数（首版不支持视频片段和 3D 文件解析）。
4. 语音策略：接入云端 TTS。
5. 协作模式：支持团队/成员/项目归属，不做细粒度角色权限。
6. 部署形态：单机自部署。
7. 队列策略：引入 `Redis + BullMQ`。

## 2. 最终推荐架构

在上述前提下，推荐采用 **“单机双进程 + Redis 队列”**：

- `Web/API`：Next.js（负责页面、鉴权、业务 API）。
- `Render Worker`：独立 Node.js 进程（消费 BullMQ 队列，执行渲染）。
- `DB`：SQLite（业务主数据）。
- `Queue`：Redis + BullMQ（异步任务与重试）。
- `Media Engine`：FFmpeg + Remotion（模板化合成）。
- `Storage`：开发期本地文件系统，线上切换 S3 兼容对象存储。

这个形态相比“全在一个进程”更稳，且不需要立即升级到复杂分布式架构。

## 3. 技术栈定版

## 3.1 前后端
- `Next.js 15`（App Router）+ `TypeScript`。
- `Tailwind CSS` + `shadcn/ui`（后台管理与编辑界面）。
- `react-hook-form` + `zod`（表单与服务端参数校验）。

## 3.2 数据与 ORM
- 数据库：`SQLite`。
- ORM：`Prisma`。
- 迁移：`Prisma Migrate`。

## 3.3 认证与团队模型
- 认证：`Auth.js (NextAuth)`。
- 首版建议登录方式：邮箱验证码（可扩展 OAuth）。
- 权限边界（MVP）：基于团队成员关系做访问隔离，不做细粒度 RBAC。

## 3.4 异步任务与队列
- 队列：`BullMQ`。
- Broker：`Redis`。
- 状态机：`queued -> running -> succeeded | failed | canceled`。
- 重试策略：指数退避 + 最大重试次数（建议 2~3 次）。
- 幂等键：`projectId + templateId + payloadHash`。

## 3.5 媒体处理
- 模板渲染：`Remotion`（管理镜头模板和变量注入）。
- 音视频处理：`FFmpeg`（拼接、混音、字幕烧录、转码）。
- TTS：云端 Provider（通过内部 `VoiceProvider` 接口适配，避免强绑定）。

## 3.6 日志与可观测性
- 日志：`pino`（结构化日志）。
- 错误采集：Sentry（建议接入）。
- 关键指标：
  - 渲染成功率
  - P95 渲染时长
  - 队列堆积长度
  - 失败任务重试成功率

## 4. 模块划分（单仓库版）

```text
src/
  app/                    # Next.js 页面与 API
  lib/
    auth/                 # 登录与会话
    db/                   # Prisma client 与仓储
    queue/                # BullMQ producer/consumer 封装
    media/                # Remotion + FFmpeg 管线
    tts/                  # TTS provider 抽象与实现
    storage/              # 本地/S3 存储适配
  worker/
    render-worker.ts      # 独立进程入口（消费 render 队列）
prisma/
  schema.prisma
infra/
  docker/
    docker-compose.yml    # web/worker/redis
```

## 5. MVP 数据模型

建议首版包含以下核心表：

- `users`
- `teams`
- `team_members`
- `projects`（归属 team）
- `assets`（图片素材）
- `scripts`（文案、分镜结构化数据）
- `render_jobs`（队列任务、状态、错误信息）
- `videos`（输出文件、时长、分辨率、封面）

关键关系：

- `team 1:N projects`
- `project 1:N assets`
- `project 1:N render_jobs`
- `project 1:N videos`

## 6. 单机部署建议（与你的部署偏好一致）

## 6.1 部署拓扑
- 同一台服务器运行：
  - `next-web`（Next.js）
  - `render-worker`（BullMQ consumer）
  - `redis`
- SQLite 文件放在持久化磁盘目录。
- 渲染产物输出到本地或对象存储（建议对象存储，便于后续扩容）。

## 6.2 运维要点
- 使用 `pm2` 或 `systemd` 保证 `web` 与 `worker` 进程常驻。
- 限制 Worker 并发（建议从 1~2 开始）避免单机 CPU/内存打满。
- 给渲染目录设置配额和定时清理策略。

## 7. 风险边界与升级触发条件

## 7.1 当前边界（MVP 可接受）
- SQLite 写并发有限，但 MVP 阶段可接受。
- 单机部署存在单点风险，但换来最低复杂度。

## 7.2 升级触发（满足任一即进入下一阶段）
- 日渲染任务连续 7 天 > 500。
- 渲染排队等待时间 P95 > 3 分钟。
- SQLite 锁冲突显著增加，影响核心流程。
- 需要多地区部署或高可用 SLA。

## 7.3 升级路径
1. 数据库：SQLite -> Postgres。
2. 队列：Redis 单实例 -> 托管 Redis。
3. 渲染：单 Worker -> 多 Worker 横向扩容。
4. 权限：团队隔离 -> 标准 RBAC（owner/editor/viewer）。

## 8. 4 周交付里程碑（MVP）

1. 第 1 周：项目骨架、认证、团队与项目模型、素材上传。
2. 第 2 周：模板引擎、文案/分镜编辑、TTS 接入。
3. 第 3 周：BullMQ 队列、Worker 渲染管线、任务状态回传。
4. 第 4 周：导出下载、失败重试、监控告警、上线部署。

## 9. 最终结论

基于你的最新决策，MVP 推荐定版为：

- `Next.js + TypeScript + Prisma(SQLite)`
- `Redis + BullMQ`（异步渲染任务）
- `Remotion + FFmpeg`（模板化视频合成）
- `Auth.js + Team/Project 隔离模型`
- 单机部署（web + worker + redis）

这套方案能在保证开发速度的前提下，显著降低长任务对主站稳定性的影响，并保留清晰的后续扩展路径。
