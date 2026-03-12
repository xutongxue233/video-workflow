"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import {
  getSsrSafeInitialModelProviders,
  loadStoredModelProvidersFromLocalStorage,
  toRuntimeTextModelConfig,
  toRuntimeVideoModelConfig,
  type StoredModelProvider,
} from "@/lib/models/model-settings.local";
import {
  WORKFLOW_DEFAULT_PROJECT_ID,
  normalizeProjectIdInput,
} from "@/lib/projects/project-navigation";
import {
  loadProjectScopedConfig,
  trySaveProjectScopedConfig,
} from "@/lib/projects/project-scoped-config";
import {
  buildProjectScopedAssetsUrl,
  filterMaterialAssetsByProject,
} from "@/lib/projects/workspace-refresh";

type Locale = "zh-CN" | "en-US";
type StepId = "script" | "video";

type RequestState = { loading: boolean; result: string };
type JsonRecord = Record<string, unknown>;

type GeneratedShot = {
  index: number;
  durationSec: number;
  visual: string;
  caption: string;
  camera: string;
};

type EditableShot = {
  id: string;
  durationSec: number;
  visual: string;
  caption: string;
  camera: string;
};

type GeneratedStructuredJson = {
  title: string;
  hook: string;
  voiceover: string;
  cta: string;
  shots: GeneratedShot[];
};

type StepView = {
  id: StepId;
  title: string;
  hint: string;
  done: boolean;
  blocked: boolean;
};

type ProjectSummaryItem = {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string;
  counts: {
    assets: number;
    scripts: number;
    renderJobs: number;
    videos: number;
  };
};

type MaterialAssetItem = {
  id: string;
  projectId: string;
  fileName: string | null;
  url: string;
  createdAt: string;
};

type ScriptHistoryItem = {
  id: string;
  projectId: string;
  title: string | null;
  hook: string | null;
  cta: string | null;
  generatorModel: string | null;
  updatedAt: string;
};

type RenderHistoryItem = {
  id: string;
  projectId: string;
  status: string;
  provider: string | null;
  scriptId: string | null;
  videoUrl: string | null;
  progress?: {
    completed: number;
    total: number;
    failed: number;
  } | null;
  referenceAssets?: Array<{
    id: string;
    projectId: string;
    fileName: string | null;
    url: string;
  }>;
  updatedAt: string;
};

type RenderShotStatusItem = {
  shotIndex: number;
  status: string;
  errorMessage?: string;
};

type PreviewDialogState = {
  kind: "image" | "video";
  url: string;
  title: string;
};

type Dict = {
  localeLabel: string;
  modelSettings: string;
  backToHome: string;
  textModelProvider: string;
  videoModelProvider: string;
  manualModel: string;
  modelUnknown: string;
  providerUnknown: string;
  queuedFallback: string;
  languages: Record<Locale, string>;
  heroTag: string;
  heroTitle: string;
  heroDesc: string;
  completion: string;
  uiLang: string;
  contentLang: string;
  projectIdLabel: string;
  projectIdHint: string;
  progressTitle: string;
  progressHint: string;
  quickLang: string;
  responseTitle: string;
  responseEmpty: string;
  errorPrefix: string;
  stepTag: string;
  stepNames: Record<StepId, string>;
  stepHints: Record<StepId, string>;
  stepState: {
    done: string;
    blocked: string;
    active: string;
    pending: string;
  };
  asset: {
    title: string;
    desc: string;
    fileLabel: string;
    submit: string;
    submitting: string;
    chooseFile: string;
    preview: string;
  };
  script: {
    title: string;
    desc: string;
    product: string;
    productPh: string;
    points: string;
    pointsPh: string;
    audience: string;
    audiencePh: string;
    tone: string;
    tonePh: string;
    duration: string;
    outLang: string;
    submit: string;
    submitting: string;
    editTitle: string;
    fieldTitle: string;
    hook: string;
    sellPoints: string;
    storyboard: string;
    cta: string;
    save: string;
    saving: string;
    scriptId: string;
    scriptIdPh: string;
    scriptIdHint: string;
    needPoints: string;
    needScriptId: string;
  };
  video: {
    title: string;
    desc: string;
    ratio: string;
    voiceStyle: string;
    voiceStylePh: string;
    vertical: string;
    horizontal: string;
    submit: string;
    submitting: string;
    needScriptId: string;
    hint: string;
    jobId: string;
    status: string;
    polling: string;
    retry: string;
    retrying: string;
    shotStatus: string;
    ready: string;
  };
};

const LOCALE_KEY = "video-workflow-locale";
const LOCALES: Locale[] = ["zh-CN", "en-US"];
const DEFAULT_GENERATION_PAYLOAD = {
  productName: "Miniature Dragon",
  sellingPointsText: "high detail, easy support removal",
  targetAudience: "tabletop gamers",
  tone: "energetic",
  durationSec: 30,
};
const DEFAULT_VOICE_STYLE = "energetic";

function localize(locale: Locale, zh: string, en: string): string {
  return locale === "zh-CN" ? zh : en;
}

const TEXT: Record<Locale, Dict> = {
  "zh-CN": {
    localeLabel: "界面语言",
    modelSettings: "模型配置",
    backToHome: "返回首页",
    textModelProvider: "文本模型供应商",
    videoModelProvider: "视频模型供应商",
    manualModel: "手动模型",
    modelUnknown: "模型未知",
    providerUnknown: "供应商未知",
    queuedFallback: "排队中",
    languages: { "zh-CN": "中文", "en-US": "English" },
    heroTag: "3D 打印短视频流程",
    heroTitle: "OpenAI + SeaDance 创作控制台",
    heroDesc: "从素材到成片的一站式工作流，统一状态反馈和语言切换。",
    completion: "流程完成度",
    uiLang: "界面语言",
    contentLang: "脚本输出语言",
    projectIdLabel: "项目切换",
    projectIdHint: "项目 ID 由系统自动生成，可在下拉列表里切换已有项目。",
    progressTitle: "执行进度",
    progressHint: "按 1-3 顺序推进，减少返工。",
    quickLang: "快速切换",
    responseTitle: "接口响应",
    responseEmpty: "还没有响应数据。",
    errorPrefix: "请求失败",
    stepTag: "步骤",
    stepNames: {
      script: "生成与编辑脚本",
      video: "提交视频生成",
    },
    stepHints: {
      script: "先生成再编辑。",
      video: "有脚本 ID 后可入队。",
    },
    stepState: {
      done: "已完成",
      blocked: "等待前置",
      active: "进行中",
      pending: "待开始",
    },
    asset: {
      title: "素材上传",
      desc: "上传当前项目源图。",
      fileLabel: "选择素材文件",
      submit: "上传图片",
      submitting: "上传中...",
      chooseFile: "请先选择文件。",
      preview: "素材预览",
    },
    script: {
      title: "脚本生成与编辑",
      desc: "调用 OpenAI 兼容接口生成结构化脚本，再进行编辑。",
      product: "产品名称",
      productPh: "例如：Miniature Dragon",
      points: "卖点（逗号/换行分隔）",
      pointsPh: "高细节, 易去支撑",
      audience: "目标人群",
      audiencePh: "例如：桌游玩家",
      tone: "语气风格",
      tonePh: "例如：energetic",
      duration: "时长（秒）",
      outLang: "脚本输出语言",
      submit: "生成脚本 + 分镜",
      submitting: "生成中...",
      editTitle: "可编辑字段",
      fieldTitle: "标题",
      hook: "开场钩子",
      sellPoints: "卖点文案",
      storyboard: "分镜",
      cta: "行动号召（CTA）",
      save: "保存脚本编辑",
      saving: "保存中...",
      scriptId: "脚本 ID",
      scriptIdPh: "scr_xxx",
      scriptIdHint: "也可以手动填入已有脚本 ID 继续后续流程。",
      needPoints: "请至少填写一个卖点。",
      needScriptId: "请先生成脚本或输入已有脚本 ID。",
    },
    video: {
      title: "视频任务入队",
      desc: "选择画幅与音色风格后，提交 SeaDance 直出有声视频任务。",
      ratio: "画幅比例",
      voiceStyle: "配音风格",
      voiceStylePh: "例如：energetic",
      vertical: "9:16（竖屏）",
      horizontal: "16:9（横屏）",
      submit: "提交 SeaDance 任务",
      submitting: "入队中...",
      needScriptId: "缺少脚本 ID，无法生成视频。",
      hint: "需要先在步骤 2 获取有效的脚本 ID。",
      jobId: "任务 ID",
      status: "任务状态",
      polling: "正在查询任务状态...",
      retry: "重试未完成分镜",
      retrying: "重试中...",
      shotStatus: "分镜进度",
      ready: "视频已生成",
    },
  },
  "en-US": {
    localeLabel: "Interface Language",
    modelSettings: "Model Settings",
    backToHome: "Back to Home",
    textModelProvider: "Text Model Provider",
    videoModelProvider: "Video Model Provider",
    manualModel: "manual model",
    modelUnknown: "model n/a",
    providerUnknown: "provider n/a",
    queuedFallback: "QUEUED",
    languages: { "zh-CN": "中文", "en-US": "English" },
    heroTag: "3D Print Short-Video Workflow",
    heroTitle: "OpenAI + SeaDance Studio Console",
    heroDesc: "Single-screen workflow from assets to final render with stronger stage feedback.",
    completion: "Workflow Completion",
    uiLang: "Interface Language",
    contentLang: "Script Output Language",
    projectIdLabel: "Switch Project",
    projectIdHint: "Project IDs are auto-generated. Use the list to switch between existing projects.",
    progressTitle: "Progress",
    progressHint: "Complete steps 1-3 in order.",
    quickLang: "Quick Switch",
    responseTitle: "API Response",
    responseEmpty: "No response yet.",
    errorPrefix: "Request failed",
    stepTag: "Step",
    stepNames: {
      script: "Generate & Edit Script",
      video: "Queue Video Render",
    },
    stepHints: {
      script: "Generate first, then edit.",
      video: "Queue once Script ID is available.",
    },
    stepState: {
      done: "Done",
      blocked: "Blocked",
      active: "In Progress",
      pending: "Pending",
    },
    asset: {
      title: "Asset Upload",
      desc: "Upload a source image for the current project.",
      fileLabel: "Select asset file",
      submit: "Upload Image",
      submitting: "Uploading...",
      chooseFile: "Please choose a file first.",
      preview: "Asset Preview",
    },
    script: {
      title: "Script Generation & Editing",
      desc: "Generate structured script via OpenAI-compatible API, then refine fields.",
      product: "Product Name",
      productPh: "e.g. Miniature Dragon",
      points: "Selling points (comma/newline separated)",
      pointsPh: "high detail, easy support removal",
      audience: "Target Audience",
      audiencePh: "e.g. tabletop gamers",
      tone: "Tone",
      tonePh: "e.g. energetic",
      duration: "Duration (sec)",
      outLang: "Script Output Language",
      submit: "Generate Script + Storyboard",
      submitting: "Generating...",
      editTitle: "Editable Fields",
      fieldTitle: "Title",
      hook: "Hook",
      sellPoints: "Selling Points",
      storyboard: "Storyboard",
      cta: "CTA",
      save: "Save Script Edits",
      saving: "Saving...",
      scriptId: "Script ID",
      scriptIdPh: "scr_xxx",
      scriptIdHint: "You can paste an existing Script ID to continue.",
      needPoints: "Please provide at least one selling point.",
      needScriptId: "Generate a script first or provide an existing Script ID.",
    },
    video: {
      title: "Queue Video Generation",
      desc: "Choose aspect ratio and voice style, then submit a SeaDance audio-video task.",
      ratio: "Aspect Ratio",
      voiceStyle: "Voice Style",
      voiceStylePh: "e.g. energetic",
      vertical: "9:16 (Vertical)",
      horizontal: "16:9 (Horizontal)",
      submit: "Queue SeaDance Video",
      submitting: "Queueing...",
      needScriptId: "scriptId is required to generate video.",
      hint: "A valid Script ID from step 2 is required.",
      jobId: "Render Job ID",
      status: "Render Status",
      polling: "Polling render status...",
      retry: "Retry Unfinished Shots",
      retrying: "Retrying...",
      shotStatus: "Shot Progress",
      ready: "Video is ready",
    },
  },
};

function formatJson(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }
  return JSON.stringify(data, null, 2);
}

function toJsonRecord(data: unknown): JsonRecord {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {};
  }
  return data as JsonRecord;
}

function isGeneratedStructuredJson(data: unknown): data is GeneratedStructuredJson {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return false;
  }
  const record = data as JsonRecord;
  return (
    typeof record.title === "string" &&
    typeof record.hook === "string" &&
    typeof record.voiceover === "string" &&
    typeof record.cta === "string" &&
    Array.isArray(record.shots)
  );
}

function toStoryboardText(shots: GeneratedShot[]): string {
  return shots.map((shot) => `${shot.index}. ${shot.visual} | ${shot.caption} | ${shot.camera}`).join("\n");
}

function normalizeEditableShots(shots: EditableShot[]): EditableShot[] {
  const cleaned = shots
    .map((shot) => ({
      ...shot,
      durationSec: Math.max(1, Math.min(60, Math.floor(Number(shot.durationSec) || 5))),
      visual: shot.visual.trim(),
      caption: shot.caption.trim(),
      camera: shot.camera.trim(),
    }))
    .filter((shot) => shot.visual || shot.caption || shot.camera);

  if (cleaned.length > 0) {
    return cleaned;
  }

  return [{
    id: `shot-${Date.now()}`,
    durationSec: 5,
    visual: "",
    caption: "",
    camera: "",
  }];
}

function toStoryboardTextFromEditableShots(shots: EditableShot[]): string {
  const normalized = normalizeEditableShots(shots);
  return normalized
    .map((shot, index) => `${index + 1}. ${shot.visual} | ${shot.caption} | ${shot.camera}`)
    .join("\n");
}

function toGeneratedShotsFromEditableShots(shots: EditableShot[]): GeneratedShot[] {
  return normalizeEditableShots(shots).map((shot, index) => ({
    index: index + 1,
    durationSec: shot.durationSec,
    visual: shot.visual || "product close-up",
    caption: shot.caption || "",
    camera: shot.camera || "static",
  }));
}

function parseStoryboardToEditableShots(storyboard: string): EditableShot[] {
  const lines = storyboard
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed = lines.map((line, index) => {
    const content = line.replace(/^\d+\.\s*/, "");
    const [visual = "", caption = "", camera = ""] = content.split("|").map((part) => part.trim());
    return {
      id: `parsed-${index}-${Date.now()}`,
      durationSec: 5,
      visual,
      caption,
      camera,
    };
  });

  return parsed.length > 0
    ? parsed
    : [{
      id: `shot-${Date.now()}`,
      durationSec: 5,
      visual: "",
      caption: "",
      camera: "",
    }];
}

function generatedShotsToEditableShots(shots: GeneratedShot[]): EditableShot[] {
  return shots.length > 0
    ? shots.map((shot, index) => ({
      id: `shot-${index}-${Date.now()}`,
      durationSec: Math.max(1, Math.min(60, Math.floor(Number(shot.durationSec) || 5))),
      visual: shot.visual,
      caption: shot.caption,
      camera: shot.camera,
    }))
    : [{
      id: `shot-${Date.now()}`,
      durationSec: 5,
      visual: "",
      caption: "",
      camera: "",
    }];
}

function parseSellingPoints(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeFileUrl(url: string): string {
  if (url.startsWith("/files/")) {
    return `/api/files/${url.slice("/files/".length)}`;
  }
  return url;
}

function toAbsoluteFileUrl(url: string): string {
  const normalized = normalizeFileUrl(url);
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  if (typeof window === "undefined") {
    return normalized;
  }

  return new URL(normalized, window.location.origin).toString();
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function getBadge(dict: Dict, step: StepView, isActive: boolean): { text: string; cls: string } {
  if (step.done) {
    return { text: dict.stepState.done, cls: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  }
  if (step.blocked) {
    return { text: dict.stepState.blocked, cls: "border-amber-200 bg-amber-50 text-amber-700" };
  }
  if (isActive) {
    return { text: dict.stepState.active, cls: "border-teal-200 bg-teal-50 text-teal-700" };
  }
  return { text: dict.stepState.pending, cls: "border-slate-200 bg-slate-100 text-slate-600" };
}

function ResponsePanel({
  heading,
  state,
  empty,
}: {
  heading: string;
  state: RequestState;
  empty: string;
}) {
  return (
    <details className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950" open={Boolean(state.result) || state.loading}>
      <summary className="cursor-pointer list-none px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
        {heading}
      </summary>
      <pre role="status" aria-live="polite" className="max-h-52 overflow-auto px-4 pb-4 text-xs leading-5 text-slate-100">
        {state.result || empty}
      </pre>
    </details>
  );
}

function MediaPreviewDialog({
  preview,
  locale,
  onClose,
}: {
  preview: PreviewDialogState | null;
  locale: Locale;
  onClose: () => void;
}) {
  if (!preview) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/75 p-4" onClick={onClose} role="presentation">
      <div
        className="w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 shadow-[0_25px_80px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={preview.title}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <p className="truncate text-sm font-semibold text-slate-100">{preview.title}</p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
          >
            {localize(locale, "关闭", "Close")}
          </button>
        </div>

        <div className="max-h-[82vh] overflow-auto p-4">
          {preview.kind === "image" ? (
            <div className="flex justify-center rounded-2xl bg-slate-900 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.url} alt={preview.title} className="max-h-[74vh] w-auto max-w-full rounded-xl object-contain" />
            </div>
          ) : (
            <div className="flex justify-center rounded-2xl bg-black p-2">
              <video
                className="max-h-[74vh] w-full rounded-xl bg-black object-contain"
                controls
                autoPlay
                preload="metadata"
                src={preview.url}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const params = useParams<{ projectId: string }>();
  const routeProjectIdRaw = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;
  const routeProjectId = normalizeProjectIdInput(decodeURIComponent(routeProjectIdRaw ?? WORKFLOW_DEFAULT_PROJECT_ID));

  const [locale, setLocale] = useState<Locale>("zh-CN");
  const [contentLanguage, setContentLanguage] = useState<Locale>("zh-CN");

  const projectId = routeProjectId;

  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [assetUrl, setAssetUrl] = useState("");
  const [assetState, setAssetState] = useState<RequestState>({ loading: false, result: "" });

  const [scriptId, setScriptId] = useState("");
  const [generationPayload, setGenerationPayload] = useState(DEFAULT_GENERATION_PAYLOAD);
  const [scriptPayload, setScriptPayload] = useState({
    title: "",
    hook: "",
    sellingPoints: "",
    storyboard: "",
    cta: "",
  });
  const [scriptShots, setScriptShots] = useState<EditableShot[]>(() => [{
    id: "shot-initial",
    durationSec: 5,
    visual: "",
    caption: "",
    camera: "",
  }]);
  const [scriptState, setScriptState] = useState<RequestState>({ loading: false, result: "" });

  const [voiceStyle, setVoiceStyle] = useState(DEFAULT_VOICE_STYLE);

  const [renderState, setRenderState] = useState<RequestState>({ loading: false, result: "" });
  const [renderJobId, setRenderJobId] = useState("");
  const [renderJobStatus, setRenderJobStatus] = useState("");
  const [renderVideoUrl, setRenderVideoUrl] = useState("");
  const [renderProgress, setRenderProgress] = useState<{ completed: number; total: number; failed: number } | null>(null);
  const [renderShotStatuses, setRenderShotStatuses] = useState<RenderShotStatusItem[]>([]);
  const [activeRenderReferenceAssets, setActiveRenderReferenceAssets] = useState<RenderHistoryItem["referenceAssets"]>([]);
  const [renderPollNonce, setRenderPollNonce] = useState(0);
  const [renderAspectRatio, setRenderAspectRatio] = useState<"9:16" | "16:9">("9:16");
  const [storedModelProviders, setStoredModelProviders] = useState<StoredModelProvider[]>(() =>
    getSsrSafeInitialModelProviders(),
  );
  const [selectedTextProviderId, setSelectedTextProviderId] = useState("");
  const [selectedVideoProviderId, setSelectedVideoProviderId] = useState("");
  const [projects, setProjects] = useState<ProjectSummaryItem[]>([]);
  const [materialLibrary, setMaterialLibrary] = useState<MaterialAssetItem[]>([]);
  const [scriptHistory, setScriptHistory] = useState<ScriptHistoryItem[]>([]);
  const [renderHistory, setRenderHistory] = useState<RenderHistoryItem[]>([]);
  const [selectedReferenceAssetIds, setSelectedReferenceAssetIds] = useState<string[]>([]);
  const [workspaceState, setWorkspaceState] = useState<RequestState>({ loading: false, result: "" });
  const [previewDialog, setPreviewDialog] = useState<PreviewDialogState | null>(null);
  const [preferredStepId, setPreferredStepId] = useState<StepId>("script");
  const [hydratedProjectId, setHydratedProjectId] = useState("");

  const closePreviewDialog = useCallback(() => {
    setPreviewDialog(null);
  }, []);

  const openImagePreview = useCallback((url: string, title: string) => {
    setPreviewDialog({
      kind: "image",
      url: normalizeFileUrl(url),
      title,
    });
  }, []);

  const openVideoPreview = useCallback((url: string, title: string) => {
    setPreviewDialog({
      kind: "video",
      url,
      title,
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem(LOCALE_KEY, locale);
  }, [locale]);

  useEffect(() => {
    if (!previewDialog) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePreviewDialog();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closePreviewDialog, previewDialog]);

  useEffect(() => {
    const reloadProviders = () => {
      setStoredModelProviders(loadStoredModelProvidersFromLocalStorage());
    };

    reloadProviders();
    window.addEventListener("focus", reloadProviders);
    window.addEventListener("storage", reloadProviders);

    return () => {
      window.removeEventListener("focus", reloadProviders);
      window.removeEventListener("storage", reloadProviders);
    };
  }, []);

  const refreshWorkspace = useCallback(async (targetProjectId = projectId) => {
    const normalizedProjectId = targetProjectId.trim();

    if (!normalizedProjectId) {
      setProjects([]);
      setScriptHistory([]);
      setRenderHistory([]);
      setMaterialLibrary([]);
      return;
    }

    setWorkspaceState({
      loading: true,
      result: localize(locale, "正在刷新项目与素材库...", "Refreshing project workspace..."),
    });

    try {
      const [projectsResponse, assetsResponse, scriptsResponse, jobsResponse] = await Promise.all([
        fetch("/api/projects?limit=60"),
        fetch(buildProjectScopedAssetsUrl(normalizedProjectId, 120)),
        fetch(`/api/scripts?projectId=${encodeURIComponent(normalizedProjectId)}&limit=30`),
        fetch(`/api/render-jobs?projectId=${encodeURIComponent(normalizedProjectId)}&limit=30`),
      ]);

      const [projectsData, assetsData, scriptsData, jobsData] = await Promise.all([
        readJsonResponse(projectsResponse),
        readJsonResponse(assetsResponse),
        readJsonResponse(scriptsResponse),
        readJsonResponse(jobsResponse),
      ]);

      const projectItems = Array.isArray(toJsonRecord(projectsData).items)
        ? (toJsonRecord(projectsData).items as ProjectSummaryItem[])
        : [];
      const materialItems = Array.isArray(toJsonRecord(assetsData).items)
        ? filterMaterialAssetsByProject(
          (toJsonRecord(assetsData).items as MaterialAssetItem[]).map((item) => ({
            ...item,
            url: normalizeFileUrl(item.url),
          })),
          normalizedProjectId,
        )
        : [];
      const scriptItems = Array.isArray(toJsonRecord(scriptsData).items)
        ? (toJsonRecord(scriptsData).items as ScriptHistoryItem[])
        : [];
      const renderItems = Array.isArray(toJsonRecord(jobsData).items)
        ? (toJsonRecord(jobsData).items as RenderHistoryItem[]).map((item) => ({
          ...item,
          videoUrl: item.videoUrl ? normalizeFileUrl(item.videoUrl) : item.videoUrl,
          referenceAssets: Array.isArray(item.referenceAssets)
            ? item.referenceAssets.map((asset) => ({
              ...asset,
              url: normalizeFileUrl(asset.url),
            }))
            : [],
        }))
        : [];

      setProjects(projectItems);
      setMaterialLibrary(materialItems);
      setScriptHistory(scriptItems);
      setRenderHistory(renderItems);
      setSelectedReferenceAssetIds((prev) => {
        const idSet = new Set(materialItems.map((item) => item.id));
        return prev.filter((id) => idSet.has(id));
      });

      if (!projectsResponse.ok || !assetsResponse.ok || !scriptsResponse.ok || !jobsResponse.ok) {
        setWorkspaceState({
          loading: false,
          result: localize(locale, "部分记录加载失败，请检查接口响应。", "Partial workspace load failed."),
        });
        return;
      }

      const currentProject = projectItems.find((item) => item.id === normalizedProjectId);
      setWorkspaceState({
        loading: false,
        result: localize(
          locale,
          `已加载项目 ${normalizedProjectId}，脚本 ${scriptItems.length} 条，任务 ${renderItems.length} 条，素材库 ${materialItems.length} 条。`,
          `Loaded ${normalizedProjectId}: ${scriptItems.length} scripts, ${renderItems.length} jobs, ${materialItems.length} materials.`,
        ),
      });

      if (!currentProject) {
        setProjects((prev) => [
          {
            id: normalizedProjectId,
            name: normalizedProjectId,
            description: null,
            updatedAt: new Date().toISOString(),
            counts: { assets: 0, scripts: 0, renderJobs: 0, videos: 0 },
          },
          ...prev,
        ]);
      }
    } catch (error) {
      setWorkspaceState({
        loading: false,
        result:
          error instanceof Error
            ? `${localize(locale, "加载工作区失败", "Failed to load workspace")}: ${error.message}`
            : localize(locale, "加载工作区失败", "Failed to load workspace"),
      });
    }
  }, [locale, projectId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshWorkspace(projectId);
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [projectId, refreshWorkspace]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const normalizedProjectId = projectId.trim();
      if (!normalizedProjectId) {
        setHydratedProjectId("");
        return;
      }

      const saved = loadProjectScopedConfig(window.localStorage, normalizedProjectId);
      if (!saved) {
        setGenerationPayload(DEFAULT_GENERATION_PAYLOAD);
        setContentLanguage(locale);
        setVoiceStyle(DEFAULT_VOICE_STYLE);
        setRenderAspectRatio("9:16");
        setSelectedTextProviderId("");
        setSelectedVideoProviderId("");
        setSelectedReferenceAssetIds([]);
        setHydratedProjectId(normalizedProjectId);
        return;
      }

      setGenerationPayload(saved.generationPayload);
      setContentLanguage(saved.contentLanguage);
      setVoiceStyle(saved.voiceStyle);
      setRenderAspectRatio(saved.renderAspectRatio);
      setSelectedTextProviderId(saved.selectedTextProviderId);
      setSelectedVideoProviderId(saved.selectedVideoProviderId);
      setSelectedReferenceAssetIds(saved.selectedReferenceAssetIds);
      setHydratedProjectId(normalizedProjectId);
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [projectId, locale]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const normalizedProjectId = projectId.trim();
    if (!normalizedProjectId) {
      return;
    }

    if (hydratedProjectId !== normalizedProjectId) {
      return;
    }

    trySaveProjectScopedConfig({
      storage: window.localStorage,
      hydrated: true,
      projectId: normalizedProjectId,
      config: {
        generationPayload,
        contentLanguage,
        voiceStyle,
        renderAspectRatio,
        selectedTextProviderId,
        selectedVideoProviderId,
        selectedReferenceAssetIds,
      },
    });
  }, [
    hydratedProjectId,
    projectId,
    generationPayload,
    contentLanguage,
    voiceStyle,
    renderAspectRatio,
    selectedTextProviderId,
    selectedVideoProviderId,
    selectedReferenceAssetIds,
  ]);

  useEffect(() => {
    if (!renderJobId.trim()) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const terminalStatus = new Set(["SUCCEEDED", "FAILED", "CANCELED"]);

    const scheduleNextPoll = () => {
      if (cancelled) {
        return;
      }
      timer = setTimeout(() => {
        void pollStatus();
      }, 2500);
    };

    const pollStatus = async () => {
      if (cancelled) {
        return;
      }

      try {
        const response = await fetch(`/api/render-jobs/${encodeURIComponent(renderJobId)}`);
        const data = toJsonRecord(await readJsonResponse(response));

        if (!response.ok) {
          setRenderState({
            loading: false,
            result: `Request failed ${response.status}\n${formatJson(data)}`,
          });
          setRenderJobStatus("FAILED");
          return;
        }

        const status = typeof data.status === "string" ? data.status : "";
        const videoUrl = typeof data.videoUrl === "string" ? data.videoUrl : "";
        const progress =
          data.progress && typeof data.progress === "object"
            ? {
              completed: Number((data.progress as JsonRecord).completed ?? 0),
              total: Number((data.progress as JsonRecord).total ?? 0),
              failed: Number((data.progress as JsonRecord).failed ?? 0),
            }
            : null;
        const shotStatuses = Array.isArray(data.shotStatuses)
          ? data.shotStatuses
            .map((item) => ({
              shotIndex: Number((item as JsonRecord).shotIndex ?? 0),
              status: typeof (item as JsonRecord).status === "string" ? (item as JsonRecord).status as string : "",
              errorMessage:
                typeof (item as JsonRecord).errorMessage === "string"
                  ? (item as JsonRecord).errorMessage as string
                  : undefined,
            }))
            .filter((item) => Number.isFinite(item.shotIndex) && item.shotIndex > 0 && item.status.length > 0)
          : [];
        const polledReferenceAssets = Array.isArray(data.referenceAssets)
          ? data.referenceAssets
            .map((item) => {
              const record = item as JsonRecord;
              const id = typeof record.id === "string" ? record.id : "";
              const projectIdValue = typeof record.projectId === "string" ? record.projectId : "";
              const url = typeof record.url === "string" ? normalizeFileUrl(record.url) : "";
              const fileNameValue = record.fileName;
              const fileName =
                typeof fileNameValue === "string"
                  ? fileNameValue
                  : fileNameValue == null
                    ? null
                    : String(fileNameValue);

              if (!id || !projectIdValue || !url) {
                return null;
              }

              return {
                id,
                projectId: projectIdValue,
                url,
                fileName,
              };
            })
            .filter((item): item is NonNullable<typeof item> => Boolean(item))
          : null;

        setRenderJobStatus(status);
        setRenderProgress(progress);
        setRenderShotStatuses(shotStatuses);
        if (polledReferenceAssets) {
          setActiveRenderReferenceAssets(polledReferenceAssets);
        }
        setRenderState({ loading: false, result: formatJson(data) });

        if (videoUrl) {
          setRenderVideoUrl(videoUrl);
        }

        if (terminalStatus.has(status)) {
          return;
        }

        scheduleNextPoll();
      } catch (error) {
        const message = error instanceof Error ? error.message : "failed to poll render job status";
        setRenderState({
          loading: false,
          result: `Request failed 500\n${message}`,
        });
        scheduleNextPoll();
      }
    };

    void pollStatus();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [renderJobId, renderPollNonce]);

  useEffect(() => {
    const normalizedScriptId = scriptId.trim();
    if (!normalizedScriptId) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/scripts/${encodeURIComponent(normalizedScriptId)}`);
          const data = toJsonRecord(await readJsonResponse(response));
          if (!response.ok || cancelled) {
            return;
          }

          setScriptPayload((prev) => ({
            ...prev,
            title: typeof data.title === "string" ? data.title : prev.title,
            hook: typeof data.hook === "string" ? data.hook : prev.hook,
            sellingPoints: typeof data.sellingPoints === "string" ? data.sellingPoints : prev.sellingPoints,
            storyboard: typeof data.storyboard === "string" ? data.storyboard : prev.storyboard,
            cta: typeof data.cta === "string" ? data.cta : prev.cta,
          }));

          if (typeof data.structuredJson === "string") {
            try {
              const parsed = JSON.parse(data.structuredJson);
              if (isGeneratedStructuredJson(parsed)) {
                setScriptShots(generatedShotsToEditableShots(parsed.shots));
                return;
              }
            } catch {
              // keep fallback below
            }
          }

          if (typeof data.storyboard === "string" && data.storyboard.trim()) {
            setScriptShots(parseStoryboardToEditableShots(data.storyboard));
          }
        } catch {
          // Keep current editor state when read fails.
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [scriptId]);

  const dict = TEXT[locale];

  const steps = useMemo<StepView[]>(
    () => [
      { id: "script", title: dict.stepNames.script, hint: dict.stepHints.script, done: Boolean(scriptId.trim()), blocked: false },
      { id: "video", title: dict.stepNames.video, hint: dict.stepHints.video, done: Boolean(renderJobId), blocked: !scriptId.trim() },
    ],
    [dict, renderJobId, scriptId],
  );

  const completed = useMemo(() => steps.filter((step) => step.done).length, [steps]);
  const progress = useMemo(() => Math.round((completed / steps.length) * 100), [completed, steps.length]);
  const suggestedActiveStepId = useMemo<StepId>(() => {
    const idx = steps.findIndex((step) => !step.done && !step.blocked);
    if (idx >= 0) {
      return steps[idx].id;
    }
    const pending = steps.findIndex((step) => !step.done);
    return pending >= 0 ? steps[pending].id : "video";
  }, [steps]);

  const stepMap = useMemo(
    () =>
      steps.reduce(
        (acc, step, index) => {
          acc[step.id] = { ...step, index };
          return acc;
        },
        {} as Record<StepId, StepView & { index: number }>,
      ),
    [steps],
  );
  const activeStepId = useMemo<StepId>(() => {
    const current = stepMap[preferredStepId];
    if (current && !current.blocked) {
      return preferredStepId;
    }
    return suggestedActiveStepId;
  }, [preferredStepId, stepMap, suggestedActiveStepId]);
  const activeStep = stepMap[activeStepId]?.index ?? 0;

  const availableTextProviders = useMemo(
    () =>
      storedModelProviders.filter(
        (provider) => provider.enabled && provider.capability === "text" && Boolean(toRuntimeTextModelConfig(provider)),
      ),
    [storedModelProviders],
  );
  const availableVideoProviders = useMemo(
    () =>
      storedModelProviders.filter(
        (provider) =>
          provider.enabled && provider.capability === "video" && Boolean(toRuntimeVideoModelConfig(provider)),
      ),
    [storedModelProviders],
  );

  const resolvedTextProviderId = useMemo(
    () =>
      availableTextProviders.some((provider) => provider.id === selectedTextProviderId)
        ? selectedTextProviderId
        : (availableTextProviders[0]?.id ?? ""),
    [availableTextProviders, selectedTextProviderId],
  );
  const resolvedVideoProviderId = useMemo(
    () =>
      availableVideoProviders.some((provider) => provider.id === selectedVideoProviderId)
        ? selectedVideoProviderId
        : (availableVideoProviders[0]?.id ?? ""),
    [availableVideoProviders, selectedVideoProviderId],
  );

  const selectedTextProvider = useMemo(
    () => availableTextProviders.find((provider) => provider.id === resolvedTextProviderId) ?? null,
    [availableTextProviders, resolvedTextProviderId],
  );
  const selectedVideoProvider = useMemo(
    () => availableVideoProviders.find((provider) => provider.id === resolvedVideoProviderId) ?? null,
    [availableVideoProviders, resolvedVideoProviderId],
  );
  const currentProjectSummary = useMemo(
    () => projects.find((item) => item.id === projectId.trim()) ?? null,
    [projects, projectId],
  );
  const selectedReferenceAssets = useMemo(
    () => materialLibrary.filter((asset) => asset.projectId === projectId.trim() && selectedReferenceAssetIds.includes(asset.id)),
    [materialLibrary, selectedReferenceAssetIds, projectId],
  );
  const currentProjectScripts = useMemo(
    () => scriptHistory.filter((item) => item.projectId === projectId.trim()),
    [scriptHistory, projectId],
  );
  const currentProjectJobs = useMemo(
    () => renderHistory.filter((item) => item.projectId === projectId.trim()),
    [renderHistory, projectId],
  );
  const scriptJobGroups = useMemo(() => {
    const jobsByScript = new Map<string, RenderHistoryItem[]>();
    for (const job of currentProjectJobs) {
      const key = job.scriptId?.trim() || "__unspecified__";
      const list = jobsByScript.get(key) ?? [];
      list.push(job);
      jobsByScript.set(key, list);
    }

    const groups: Array<{
      key: string;
      script: ScriptHistoryItem | null;
      jobs: RenderHistoryItem[];
      latestTs: number;
    }> = currentProjectScripts.map((script) => {
      const jobs = [...(jobsByScript.get(script.id) ?? [])].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
      const latestTs = Math.max(
        new Date(script.updatedAt).getTime(),
        jobs[0] ? new Date(jobs[0].updatedAt).getTime() : 0,
      );
      return {
        key: script.id,
        script,
        jobs,
        latestTs,
      };
    });

    const linkedScriptIds = new Set(currentProjectScripts.map((script) => script.id));
    for (const [scriptId, jobs] of jobsByScript.entries()) {
      if (scriptId === "__unspecified__" || linkedScriptIds.has(scriptId)) {
        continue;
      }
      groups.push({
        key: `missing-${scriptId}`,
        script: null,
        jobs: [...jobs].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
        latestTs: jobs[0] ? new Date(jobs[0].updatedAt).getTime() : 0,
      });
    }

    const noScriptJobs = jobsByScript.get("__unspecified__") ?? [];
    if (noScriptJobs.length > 0) {
      groups.push({
        key: "__unspecified__",
        script: null,
        jobs: [...noScriptJobs].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
        latestTs: noScriptJobs[0] ? new Date(noScriptJobs[0].updatedAt).getTime() : 0,
      });
    }

    return groups
      .sort((a, b) => b.latestTs - a.latestTs)
      .slice(0, 10);
  }, [currentProjectJobs, currentProjectScripts]);
  const currentRenderJob = useMemo(
    () => currentProjectJobs.find((job) => job.id === renderJobId.trim()) ?? null,
    [currentProjectJobs, renderJobId],
  );
  const isRenderPolling = Boolean(renderJobId.trim()) &&
    !["SUCCEEDED", "FAILED", "CANCELED"].includes(renderJobStatus);
  const renderVideoResults = useMemo(() => {
    const latestResult = renderVideoUrl
      ? [{
        id: renderJobId || "latest",
        status: renderJobStatus || "SUCCEEDED",
        url: renderVideoUrl,
        updatedAt: new Date().toISOString(),
      }]
      : [];

    const historyResults = currentProjectJobs
      .filter((item) => Boolean(item.videoUrl))
      .map((item) => ({
        id: item.id,
        status: item.status,
        url: item.videoUrl as string,
        updatedAt: item.updatedAt,
      }));

    const map = new Map<string, { id: string; status: string; url: string; updatedAt: string }>();
    for (const item of [...latestResult, ...historyResults]) {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    }

    return Array.from(map.values()).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [currentProjectJobs, renderJobId, renderJobStatus, renderVideoUrl]);

  useEffect(() => {
    if (!renderJobId.trim()) {
      setActiveRenderReferenceAssets([]);
      return;
    }

    setActiveRenderReferenceAssets(currentRenderJob?.referenceAssets ?? []);
  }, [currentRenderJob, renderJobId]);

  const inputClass =
    "h-11 w-full rounded-2xl border border-slate-300/90 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-200";
  const textAreaClass =
    "w-full rounded-2xl border border-slate-300/90 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-200";
  const primaryButtonClass =
    "inline-flex h-11 cursor-pointer items-center justify-center rounded-2xl bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-55";
  const secondaryButtonClass =
    "inline-flex h-11 cursor-pointer items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-55";

  function switchLocale(next: Locale) {
    setLocale(next);
    setContentLanguage(next);
  }

  function toggleReferenceAsset(assetId: string) {
    setSelectedReferenceAssetIds((prev) => {
      if (prev.includes(assetId)) {
        return prev.filter((id) => id !== assetId);
      }

      if (prev.length >= 8) {
        return prev;
      }

      return [...prev, assetId];
    });
  }

  function updateShotField(shotId: string, field: keyof Omit<EditableShot, "id">, value: string | number) {
    setScriptShots((prev) =>
      prev.map((shot) =>
        shot.id === shotId
          ? {
            ...shot,
            [field]: field === "durationSec" ? Number(value) : value,
          }
          : shot,
      ),
    );
  }

  function addShot() {
    setScriptShots((prev) => [
      ...prev,
      {
        id: `shot-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        durationSec: 5,
        visual: "",
        caption: "",
        camera: "",
      },
    ]);
  }

  function removeShot(shotId: string) {
    setScriptShots((prev) => {
      const next = prev.filter((shot) => shot.id !== shotId);
      return next.length > 0 ? next : prev;
    });
  }

  async function handleUploadAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assetFile) {
      setAssetState({ loading: false, result: dict.asset.chooseFile });
      return;
    }

    setAssetState({ loading: true, result: dict.asset.submitting });

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("file", assetFile);

    const response = await fetch("/api/assets", { method: "POST", body: formData });
    const data = toJsonRecord(await readJsonResponse(response));

    if (response.ok) {
      const url = typeof data.url === "string" ? data.url : "";
      const uploadedAssetId = typeof data.id === "string" ? data.id : "";
      setAssetUrl(normalizeFileUrl(url));
      if (uploadedAssetId) {
        setSelectedReferenceAssetIds((prev) =>
          prev.includes(uploadedAssetId) ? prev : [...prev, uploadedAssetId].slice(0, 8),
        );
      }
      setAssetState({ loading: false, result: formatJson(data) });
      await refreshWorkspace(projectId);
      return;
    }

    setAssetState({
      loading: false,
      result: `${dict.errorPrefix} ${response.status}\n${formatJson(data)}`,
    });
  }

  async function handleGenerateScript(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sellingPoints = parseSellingPoints(generationPayload.sellingPointsText);
    const normalizedDurationSec = Math.max(5, Math.min(60, Math.floor(Number(generationPayload.durationSec) || 30)));

    if (sellingPoints.length === 0) {
      setScriptState({ loading: false, result: dict.script.needPoints });
      return;
    }

    setScriptState({ loading: true, result: dict.script.submitting });
    const runtimeTextModel = selectedTextProvider ? toRuntimeTextModelConfig(selectedTextProvider) : null;

    const response = await fetch("/api/ai/scripts/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        productName: generationPayload.productName,
        sellingPoints,
        targetAudience: generationPayload.targetAudience,
        tone: generationPayload.tone,
        durationSec: normalizedDurationSec,
        contentLanguage,
        referenceAssets: selectedReferenceAssets.map((asset) => ({
          id: asset.id,
          projectId: asset.projectId,
          fileName: asset.fileName || "unknown",
          url: toAbsoluteFileUrl(asset.url),
        })),
        modelProvider: runtimeTextModel ?? undefined,
      }),
    });

    const data = toJsonRecord(await readJsonResponse(response));

    if (response.ok) {
      if (typeof data.scriptId === "string") {
        setScriptId(data.scriptId);
      }

      if (isGeneratedStructuredJson(data.structuredJson)) {
        const structured = data.structuredJson;
        setScriptPayload({
          title: structured.title,
          hook: structured.hook,
          sellingPoints: sellingPoints.join(", "),
          storyboard: toStoryboardText(structured.shots),
          cta: structured.cta,
        });
        setScriptShots(generatedShotsToEditableShots(structured.shots));
      }

      setGenerationPayload((prev) => ({
        ...prev,
        durationSec: normalizedDurationSec,
      }));

      setRenderJobId("");
      setRenderJobStatus("");
      setRenderVideoUrl("");
      setScriptState({ loading: false, result: formatJson(data) });
      await refreshWorkspace(projectId);
      return;
    }

    setScriptState({
      loading: false,
      result: `${dict.errorPrefix} ${response.status}\n${formatJson(data)}`,
    });
  }

  async function handleAutoFillScriptInputs() {
    const runtimeTextModel = selectedTextProvider ? toRuntimeTextModelConfig(selectedTextProvider) : null;
    setScriptState({
      loading: true,
      result: localize(locale, "正在根据素材自动填充参数...", "Auto-filling fields from assets..."),
    });

    const response = await fetch("/api/ai/scripts/autofill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        contentLanguage,
        referenceAssets: selectedReferenceAssets.map((asset) => ({
          id: asset.id,
          projectId: asset.projectId,
          fileName: asset.fileName || "unknown",
          url: toAbsoluteFileUrl(asset.url),
        })),
        modelProvider: runtimeTextModel ?? undefined,
      }),
    });

    const data = toJsonRecord(await readJsonResponse(response));
    if (response.ok) {
      setGenerationPayload((prev) => ({
        ...prev,
        productName: typeof data.productName === "string" ? data.productName : prev.productName,
        targetAudience: typeof data.targetAudience === "string" ? data.targetAudience : prev.targetAudience,
        sellingPointsText: Array.isArray(data.sellingPoints)
          ? (data.sellingPoints.filter((item): item is string => typeof item === "string").join(", ") || prev.sellingPointsText)
          : prev.sellingPointsText,
        tone: typeof data.tone === "string" ? data.tone : prev.tone,
        durationSec:
          typeof data.durationSec === "number"
            ? Math.max(5, Math.min(60, Math.floor(data.durationSec)))
            : prev.durationSec,
      }));

      setScriptState({
        loading: false,
        result: formatJson(data),
      });
      return;
    }

    setScriptState({
      loading: false,
      result: `${dict.errorPrefix} ${response.status}\n${formatJson(data)}`,
    });
  }

  async function handleUpdateScript() {
    if (!scriptId.trim()) {
      setScriptState({ loading: false, result: dict.script.needScriptId });
      return;
    }
    const normalizedShots = normalizeEditableShots(scriptShots);
    const storyboard = toStoryboardTextFromEditableShots(normalizedShots);
    const structuredJson = JSON.stringify({
      title: scriptPayload.title,
      hook: scriptPayload.hook,
      voiceover: scriptPayload.sellingPoints,
      cta: scriptPayload.cta,
      shots: toGeneratedShotsFromEditableShots(normalizedShots),
    });
    const updatePayload = {
      ...scriptPayload,
      storyboard,
      structuredJson,
    };

    setScriptState({ loading: true, result: dict.script.saving });

    const response = await fetch(`/api/scripts/${scriptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatePayload),
    });

    const data = await readJsonResponse(response);

    if (response.ok) {
      setScriptPayload((prev) => ({
        ...prev,
        storyboard,
      }));
      setScriptState({ loading: false, result: formatJson(data) });
      await refreshWorkspace(projectId);
      return;
    }

    setScriptState({
      loading: false,
      result: `${dict.errorPrefix} ${response.status}\n${formatJson(data)}`,
    });
  }

  async function handleCreateRenderJob() {
    if (!scriptId.trim()) {
      setRenderState({ loading: false, result: dict.video.needScriptId });
      return;
    }
    const normalizedDurationSec = Math.max(5, Math.min(60, Math.floor(Number(generationPayload.durationSec) || 30)));

    setRenderVideoUrl("");
    setRenderJobStatus("");
    setRenderProgress(null);
    setRenderShotStatuses([]);
    setActiveRenderReferenceAssets([]);
    setRenderState({ loading: true, result: dict.video.submitting });
    const runtimeVideoModel = selectedVideoProvider ? toRuntimeVideoModelConfig(selectedVideoProvider) : null;

    const response = await fetch("/api/videos/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        scriptId,
        voiceStyle,
        aspectRatio: renderAspectRatio,
        durationSec: normalizedDurationSec,
        referenceImageUrls: selectedReferenceAssets.map((asset) => toAbsoluteFileUrl(asset.url)),
        referenceAssets: selectedReferenceAssets.map((asset) => ({
          id: asset.id,
          projectId: asset.projectId,
          fileName: asset.fileName,
          url: toAbsoluteFileUrl(asset.url),
        })),
        requestNonce: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
        selectedVideoModel: runtimeVideoModel ?? undefined,
      }),
    });

    const data = toJsonRecord(await readJsonResponse(response));

    if (response.ok) {
      const jobId = typeof data.renderJobId === "string" ? data.renderJobId : "";
      setRenderJobId(jobId);
      if (typeof data.status === "string") {
        setRenderJobStatus(data.status);
      }
      setRenderPollNonce((prev) => prev + 1);
      setRenderState({ loading: false, result: formatJson(data) });
      await refreshWorkspace(projectId);
      return;
    }

    setRenderJobId("");
    setRenderProgress(null);
    setRenderShotStatuses([]);
    setActiveRenderReferenceAssets([]);
    setRenderState({
      loading: false,
      result: `${dict.errorPrefix} ${response.status}\n${formatJson(data)}`,
    });
  }

  async function handleRetryRenderJob() {
    if (!renderJobId.trim()) {
      return;
    }

    const normalizedDurationSec = Math.max(5, Math.min(60, Math.floor(Number(generationPayload.durationSec) || 30)));
    const runtimeVideoModel = selectedVideoProvider ? toRuntimeVideoModelConfig(selectedVideoProvider) : null;

    setRenderState({ loading: true, result: dict.video.retrying });

    const response = await fetch(`/api/render-jobs/${encodeURIComponent(renderJobId)}/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        durationSec: normalizedDurationSec,
        referenceImageUrls: selectedReferenceAssets.map((asset) => toAbsoluteFileUrl(asset.url)),
        referenceAssets: selectedReferenceAssets.map((asset) => ({
          id: asset.id,
          projectId: asset.projectId,
          fileName: asset.fileName,
          url: toAbsoluteFileUrl(asset.url),
        })),
        requestNonce: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
        selectedVideoModel: runtimeVideoModel ?? undefined,
      }),
    });

    const data = toJsonRecord(await readJsonResponse(response));

    if (response.ok) {
      const status = typeof data.status === "string" ? data.status : "";
      const videoUrl = typeof data.videoUrl === "string" ? data.videoUrl : "";

      if (status) {
        setRenderJobStatus(status);
      }
      if (videoUrl) {
        setRenderVideoUrl(videoUrl);
      } else {
        setRenderVideoUrl("");
      }

      setRenderProgress(null);
      setRenderShotStatuses([]);
      setRenderPollNonce((prev) => prev + 1);
      setRenderState({ loading: false, result: formatJson(data) });
      await refreshWorkspace(projectId);
      return;
    }

    setRenderState({
      loading: false,
      result: `${dict.errorPrefix} ${response.status}\n${formatJson(data)}`,
    });
  }

  const scriptBadge = getBadge(dict, stepMap.script, activeStep === stepMap.script.index);
  const videoBadge = getBadge(dict, stepMap.video, activeStep === stepMap.video.index);

  return (
    <div className="min-h-screen overflow-x-hidden pb-20">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 overflow-x-hidden px-4 pt-6 md:px-8 lg:pt-8">
        <section className="relative overflow-hidden rounded-[30px] border border-white/70 bg-white/85 p-6 shadow-[0_22px_60px_rgba(15,23,42,0.1)] backdrop-blur md:p-8">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(15,118,110,0.22),rgba(15,118,110,0))]" />
          <div className="pointer-events-none absolute -left-14 bottom-0 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(234,88,12,0.18),rgba(234,88,12,0))]" />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{dict.heroTag}</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900 md:text-5xl">{dict.heroTitle}</h1>
              <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">{dict.heroDesc}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{dict.localeLabel}</p>
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                {LOCALES.map((option) => {
                  const active = locale === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => switchLocale(option)}
                      className={`h-9 min-w-[92px] cursor-pointer rounded-lg px-3 text-sm font-semibold transition ${
                        active ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-white hover:text-slate-900"
                      }`}
                      aria-pressed={active}
                    >
                      {dict.languages[option]}
                    </button>
                  );
                })}
              </div>
              <Link
                href="/settings"
                className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                {dict.modelSettings}
              </Link>
              <Link
                href="/"
                className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                {dict.backToHome}
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-slate-500">{dict.completion}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {completed}/{steps.length}
              </p>
              <p className="text-xs text-slate-500">{progress}%</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-slate-500">{dict.uiLang}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{dict.languages[locale]}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-slate-500">{dict.contentLang}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{dict.languages[contentLanguage]}</p>
            </article>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/90 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {localize(locale, "当前项目", "Current Project")}
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {currentProjectSummary?.name || localize(locale, "未命名项目", "Untitled Project")}
              </p>
            </div>
            <button type="button" onClick={() => void refreshWorkspace(projectId)} className={secondaryButtonClass}>
              {workspaceState.loading ? localize(locale, "刷新中...", "Refreshing...") : localize(locale, "刷新记录", "Refresh Records")}
            </button>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4 lg:sticky lg:top-6 lg:h-fit">
            <section className="rounded-3xl border border-white/70 bg-white/82 p-5 shadow-[0_14px_36px_rgba(15,23,42,0.08)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{dict.progressTitle}</p>
              <p className="mt-1 text-sm text-slate-600">{dict.progressHint}</p>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-[linear-gradient(90deg,#0f766e,#14b8a6)] transition-[width]" style={{ width: `${progress}%` }} />
              </div>

              <div className="mt-4 space-y-2">
                {steps.map((step, index) => {
                  const badge = getBadge(dict, step, index === activeStep);
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => setPreferredStepId(step.id)}
                      className="flex w-full cursor-pointer items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-teal-300 hover:bg-teal-50/40"
                      aria-current={index === activeStep ? "step" : undefined}
                    >
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                          {dict.stepTag} {String(index + 1).padStart(2, "0")}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{step.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{step.hint}</p>
                      </div>
                      <span className={`inline-flex shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${badge.cls}`}>
                        {badge.text}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{dict.quickLang}</p>
                <div className="mt-2 inline-flex w-full rounded-xl border border-slate-200 bg-slate-50 p-1">
                  {LOCALES.map((option) => {
                    const active = locale === option;
                    return (
                      <button
                        key={`quick-${option}`}
                        type="button"
                        onClick={() => switchLocale(option)}
                        className={`h-8 flex-1 cursor-pointer rounded-lg px-2 text-xs font-semibold transition ${
                          active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-white hover:text-slate-900"
                        }`}
                        aria-pressed={active}
                      >
                        {dict.languages[option]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/70 bg-white/84 p-5 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {localize(locale, "素材与上传", "Assets & Upload")}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {localize(locale, "在这里上传并选择参考素材。", "Upload and select reference assets here.")}
                  </p>
                </div>
                <span className="inline-flex rounded-full border border-teal-200 bg-teal-50 px-2 py-1 text-[11px] font-semibold text-teal-700">
                  {selectedReferenceAssets.length}/8
                </span>
              </div>

              <form className="mt-4 grid gap-2" onSubmit={handleUploadAsset}>
                <label htmlFor="asset-file" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                  {dict.asset.fileLabel}
                </label>
                <input
                  id="asset-file"
                  type="file"
                  accept="image/*"
                  onChange={(event) => setAssetFile(event.target.files?.[0] ?? null)}
                  className="block w-full cursor-pointer rounded-2xl border border-slate-300 bg-white p-2 text-xs text-slate-700 file:mr-2 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate-900 file:px-2 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                />
                <button type="submit" disabled={assetState.loading} className={primaryButtonClass}>
                  {assetState.loading ? dict.asset.submitting : dict.asset.submit}
                </button>
              </form>

              {assetUrl ? (
                <button
                  type="button"
                  onClick={() => openImagePreview(assetUrl, dict.asset.preview)}
                  className="group mt-3 block w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 text-left transition hover:border-teal-300 hover:bg-teal-50/40"
                >
                  <div className="aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={assetUrl}
                      alt="Uploaded project asset preview"
                      className="h-full w-full object-contain transition duration-200 group-hover:scale-[1.02]"
                    />
                  </div>
                </button>
              ) : null}

              <div className="mt-3 max-h-[360px] space-y-2 overflow-auto pr-1">
                {materialLibrary.slice(0, 24).map((asset) => {
                  const selected = selectedReferenceAssetIds.includes(asset.id);
                  return (
                    <article
                      key={`material-${asset.id}`}
                      className={`rounded-2xl border p-2 transition ${
                        selected
                          ? "border-teal-400 bg-teal-50/70"
                          : "border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleReferenceAsset(asset.id)}
                            className="h-4 w-4 accent-teal-700"
                          />
                          <span className="text-[11px] font-semibold text-slate-600">
                            {selected ? localize(locale, "已选中", "Selected") : localize(locale, "勾选", "Select")}
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => openImagePreview(asset.url, asset.fileName || asset.id)}
                          className="text-[11px] font-semibold text-teal-700 underline underline-offset-4"
                        >
                          {localize(locale, "预览", "Preview")}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => openImagePreview(asset.url, asset.fileName || asset.id)}
                        className="mt-2 block w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={asset.url}
                          alt={asset.fileName || asset.id}
                          className="h-24 w-full object-contain"
                        />
                      </button>
                      <p className="mt-2 truncate text-xs font-semibold text-slate-700">{asset.fileName || asset.id}</p>
                    </article>
                  );
                })}
              </div>

              <ResponsePanel heading={dict.responseTitle} state={assetState} empty={dict.responseEmpty} />
            </section>
          </aside>

	          <div className="min-w-0 space-y-6">
	            <article className="reveal-up rounded-3xl border border-white/70 bg-white/84 p-6 shadow-[0_16px_45px_rgba(15,23,42,0.08)]">
	              <div className="flex flex-wrap items-start justify-between gap-3">
	                <div>
	                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
	                    {localize(locale, "项目工作区", "Project Workspace")}
	                  </p>
	                  <h2 className="mt-1 text-2xl font-semibold text-slate-900">
	                    {currentProjectSummary?.name || localize(locale, "未命名项目", "Untitled Project")}
	                  </h2>
	                  <p className="mt-2 text-sm text-slate-600">
	                    {localize(
	                      locale,
	                      "同一项目会保留素材、文案、渲染历史与配置。",
	                      "Each project keeps materials, scripts, render history, and configuration.",
	                    )}
	                  </p>
	                </div>
	              </div>

	              <div className="mt-4 grid gap-3 sm:grid-cols-4">
	                <div className="rounded-2xl border border-slate-200 bg-white p-3">
	                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{localize(locale, "素材", "Assets")}</p>
	                  <p className="mt-1 text-xl font-semibold text-slate-900">{currentProjectSummary?.counts.assets ?? 0}</p>
	                </div>
	                <div className="rounded-2xl border border-slate-200 bg-white p-3">
	                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{localize(locale, "脚本", "Scripts")}</p>
	                  <p className="mt-1 text-xl font-semibold text-slate-900">{currentProjectSummary?.counts.scripts ?? 0}</p>
	                </div>
	                <div className="rounded-2xl border border-slate-200 bg-white p-3">
	                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{localize(locale, "任务", "Jobs")}</p>
	                  <p className="mt-1 text-xl font-semibold text-slate-900">{currentProjectSummary?.counts.renderJobs ?? 0}</p>
	                </div>
	                <div className="rounded-2xl border border-slate-200 bg-white p-3">
	                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{localize(locale, "成片", "Videos")}</p>
	                  <p className="mt-1 text-xl font-semibold text-slate-900">{currentProjectSummary?.counts.videos ?? 0}</p>
	                </div>
	              </div>

	              <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
	                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
	                  {localize(locale, "脚本与任务历史", "Script & Job Timeline")}
	                </p>
	                <div className="mt-2 max-h-[420px] space-y-3 overflow-auto pr-1">
	                  {scriptJobGroups.length > 0 ? (
	                    scriptJobGroups.map((group) => (
	                      <article key={`timeline-${group.key}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
	                        <div className="flex items-start justify-between gap-2">
	                          <div className="min-w-0">
	                            <p className="truncate text-sm font-semibold text-slate-900">
	                              {group.script?.title || localize(locale, "未命名脚本", "Untitled Script")}
	                            </p>
	                            <p className="mt-1 text-[11px] text-slate-500">
	                              {group.script
	                                ? `${new Date(group.script.updatedAt).toLocaleString(locale)} · ${group.script.generatorModel || dict.modelUnknown}`
	                                : localize(locale, "脚本信息缺失或任务未绑定脚本", "Script not found or job not linked")}
	                            </p>
	                          </div>
	                          {group.script ? (
	                            <button
	                              type="button"
	                              onClick={() => {
	                                setScriptId(group.script?.id || "");
	                                setPreferredStepId("script");
	                              }}
	                              className="shrink-0 text-[11px] font-semibold text-teal-700 underline underline-offset-4"
	                            >
	                              {localize(locale, "编辑脚本", "Edit Script")}
	                            </button>
	                          ) : null}
	                        </div>
	                        {group.jobs.length > 0 ? (
	                          <div className="mt-2 space-y-1.5">
	                            {group.jobs.slice(0, 5).map((job) => (
	                              <button
	                                key={`timeline-job-${job.id}`}
	                                type="button"
                                onClick={() => {
                                  setRenderJobId(job.id);
                                  setRenderJobStatus(job.status);
                                  setRenderProgress(job.progress ?? null);
                                  setRenderShotStatuses([]);
                                  setActiveRenderReferenceAssets(job.referenceAssets ?? []);
                                  if (job.videoUrl) {
                                    setRenderVideoUrl(job.videoUrl);
                                  } else {
                                    setRenderVideoUrl("");
                                  }
                                  setRenderPollNonce((prev) => prev + 1);
                                  setPreferredStepId("video");
                                }}
	                                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-2 py-2 text-left transition hover:border-teal-300 hover:bg-teal-50"
	                              >
	                                <span className="min-w-0">
                                    <span className="block truncate text-xs font-semibold text-slate-800">{job.id}</span>
                                    {Array.isArray(job.referenceAssets) && job.referenceAssets.length > 0 ? (
                                      <span className="mt-0.5 block truncate text-[11px] text-teal-700">
                                        {localize(locale, `参考素材 ${job.referenceAssets.length} 张`, `${job.referenceAssets.length} reference assets`)}
                                      </span>
                                    ) : null}
                                  </span>
	                                <span className="ml-2 shrink-0 text-[11px] text-slate-500">
	                                  {job.status} · {new Date(job.updatedAt).toLocaleString(locale)}
	                                </span>
	                              </button>
	                            ))}
	                          </div>
	                        ) : (
	                          <p className="mt-2 text-xs text-slate-500">{localize(locale, "该脚本还没有任务。", "No jobs under this script yet.")}</p>
	                        )}
	                      </article>
	                    ))
	                  ) : (
	                    <p className="text-xs text-slate-500">{localize(locale, "暂无脚本与任务历史。", "No scripts or jobs yet.")}</p>
	                  )}
	                </div>
	              </section>
	            </article>

            {activeStepId === "script" ? (
            <article id="stage-script" className="reveal-up rounded-3xl border border-white/70 bg-white/84 p-6 shadow-[0_16px_45px_rgba(15,23,42,0.08)]" style={{ animationDelay: "60ms" }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{dict.stepTag} 01</p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-900">{dict.script.title}</h2>
                  <p className="mt-2 text-sm text-slate-600">{dict.script.desc}</p>
                </div>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${scriptBadge.cls}`}>
                  {scriptBadge.text}
                </span>
              </div>

              <form className="mt-5 space-y-3" onSubmit={handleGenerateScript}>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-sm font-semibold text-slate-700">{dict.script.product}</span>
                    <input
                      value={generationPayload.productName}
                      onChange={(event) =>
                        setGenerationPayload((prev) => ({
                          ...prev,
                          productName: event.target.value,
                        }))
                      }
                      placeholder={dict.script.productPh}
                      className={inputClass}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-semibold text-slate-700">{dict.script.audience}</span>
                    <input
                      value={generationPayload.targetAudience}
                      onChange={(event) =>
                        setGenerationPayload((prev) => ({
                          ...prev,
                          targetAudience: event.target.value,
                        }))
                      }
                      placeholder={dict.script.audiencePh}
                      className={inputClass}
                    />
                  </label>
                </div>

                <label className="space-y-1">
                  <span className="text-sm font-semibold text-slate-700">{dict.script.points}</span>
                  <textarea
                    value={generationPayload.sellingPointsText}
                    onChange={(event) =>
                      setGenerationPayload((prev) => ({
                        ...prev,
                        sellingPointsText: event.target.value,
                      }))
                    }
                    rows={2}
                    placeholder={dict.script.pointsPh}
                    className={textAreaClass}
                  />
                </label>

                <div className="grid gap-3 md:grid-cols-3">
                  <label className="space-y-1">
                    <span className="text-sm font-semibold text-slate-700">{dict.script.tone}</span>
                    <input
                      value={generationPayload.tone}
                      onChange={(event) =>
                        setGenerationPayload((prev) => ({
                          ...prev,
                          tone: event.target.value,
                        }))
                      }
                      placeholder={dict.script.tonePh}
                      className={inputClass}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-semibold text-slate-700">{dict.script.duration}</span>
                    <input
                      type="number"
                      min={5}
                      max={60}
                      value={generationPayload.durationSec}
                      onChange={(event) =>
                        setGenerationPayload((prev) => ({
                          ...prev,
                          durationSec: Number(event.target.value),
                        }))
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-semibold text-slate-700">{dict.script.outLang}</span>
                    <select value={contentLanguage} onChange={(event) => setContentLanguage(event.target.value as Locale)} className={inputClass}>
                      {LOCALES.map((option) => (
                        <option key={`out-${option}`} value={option}>
                          {dict.languages[option]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{dict.textModelProvider}</p>
                  {availableTextProviders.length > 0 ? (
                    <select
                      value={resolvedTextProviderId}
                      onChange={(event) => setSelectedTextProviderId(event.target.value)}
                      className={`${inputClass} mt-2`}
                    >
                      {availableTextProviders.map((provider) => (
                        <option key={`text-provider-${provider.id}`} value={provider.id}>
                          {provider.name} | {provider.selectedModelId || provider.manualModelId || dict.manualModel}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-2 text-xs text-slate-600">
                      {localize(locale, "未发现可用文本模型，请先在", "No text model available. Enable one in ")}
                      <Link href="/settings" className="font-semibold text-teal-700 underline underline-offset-4">
                        {localize(locale, "设置页", "Settings")}
                      </Link>
                      {localize(locale, "启用文本供应商。", ".")}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                    {localize(locale, "素材参考上下文", "Material Context")}
                  </p>
                  {selectedReferenceAssets.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedReferenceAssets.map((asset) => (
                        <span key={`selected-ref-${asset.id}`} className="inline-flex rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
                          {asset.fileName || asset.id}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-600">
                      {localize(
                        locale,
                        "未选择参考素材，文案将仅基于文本参数生成。",
                        "No reference materials selected. Script generation will use text inputs only.",
                      )}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void handleAutoFillScriptInputs()}
                  disabled={scriptState.loading || selectedReferenceAssets.length === 0}
                  className={secondaryButtonClass}
                >
                  {localize(locale, "根据素材自动填充参数", "Auto-fill fields from assets")}
                </button>

                <button type="submit" disabled={scriptState.loading} className={primaryButtonClass}>
                  {scriptState.loading ? dict.script.submitting : dict.script.submit}
                </button>
              </form>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{dict.script.editTitle}</p>
                <div className="mt-3 space-y-3">
                  <label className="space-y-1">
                    <span className="text-sm font-semibold text-slate-700">{dict.script.fieldTitle}</span>
                    <input
                      value={scriptPayload.title}
                      onChange={(event) =>
                        setScriptPayload((prev) => ({
                          ...prev,
                          title: event.target.value,
                        }))
                      }
                      className={inputClass}
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-sm font-semibold text-slate-700">{dict.script.hook}</span>
                    <textarea
                      value={scriptPayload.hook}
                      onChange={(event) =>
                        setScriptPayload((prev) => ({
                          ...prev,
                          hook: event.target.value,
                        }))
                      }
                      rows={2}
                      className={textAreaClass}
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-sm font-semibold text-slate-700">{dict.script.sellPoints}</span>
                    <textarea
                      value={scriptPayload.sellingPoints}
                      onChange={(event) =>
                        setScriptPayload((prev) => ({
                          ...prev,
                          sellingPoints: event.target.value,
                        }))
                      }
                      rows={2}
                      className={textAreaClass}
                    />
                  </label>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-700">{dict.script.storyboard}</span>
                      <button
                        type="button"
                        onClick={addShot}
                        className="text-xs font-semibold text-teal-700 underline underline-offset-4"
                      >
                        {localize(locale, "新增分镜", "Add Shot")}
                      </button>
                    </div>
                    <div className="space-y-2">
                      {scriptShots.map((shot, index) => (
                        <div key={shot.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                              {localize(locale, "分镜", "Shot")} {index + 1}
                            </p>
                            <button
                              type="button"
                              onClick={() => removeShot(shot.id)}
                              disabled={scriptShots.length <= 1}
                              className="text-[11px] font-semibold text-slate-500 underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {localize(locale, "删除", "Remove")}
                            </button>
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            <input
                              value={shot.visual}
                              onChange={(event) => updateShotField(shot.id, "visual", event.target.value)}
                              placeholder={localize(locale, "画面描述", "Visual description")}
                              className={inputClass}
                            />
                            <input
                              value={shot.camera}
                              onChange={(event) => updateShotField(shot.id, "camera", event.target.value)}
                              placeholder={localize(locale, "镜头语言", "Camera movement")}
                              className={inputClass}
                            />
                            <input
                              value={shot.caption}
                              onChange={(event) => updateShotField(shot.id, "caption", event.target.value)}
                              placeholder={localize(locale, "字幕文案", "Caption text")}
                              className={inputClass}
                            />
                            <input
                              type="number"
                              min={1}
                              max={60}
                              value={shot.durationSec}
                              onChange={(event) => updateShotField(shot.id, "durationSec", Number(event.target.value))}
                              placeholder={localize(locale, "时长（秒）", "Duration (sec)")}
                              className={inputClass}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <label className="space-y-1">
                    <span className="text-sm font-semibold text-slate-700">{dict.script.cta}</span>
                    <input
                      value={scriptPayload.cta}
                      onChange={(event) =>
                        setScriptPayload((prev) => ({
                          ...prev,
                          cta: event.target.value,
                        }))
                      }
                      className={inputClass}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleUpdateScript}
                    disabled={scriptState.loading || !scriptId.trim()}
                    className={secondaryButtonClass}
                  >
                    {scriptState.loading ? dict.script.saving : dict.script.save}
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <label htmlFor="script-id" className="text-sm font-semibold text-slate-700">
                  {dict.script.scriptId}
                </label>
                <input
                  id="script-id"
                  value={scriptId}
                  onChange={(event) => setScriptId(event.target.value)}
                  placeholder={dict.script.scriptIdPh}
                  className={`${inputClass} mt-1`}
                />
                <p className="mt-1 text-xs text-slate-500">{dict.script.scriptIdHint}</p>
              </div>

              <ResponsePanel heading={dict.responseTitle} state={scriptState} empty={dict.responseEmpty} />
            </article>
            ) : null}
            {activeStepId === "video" ? (
            <article id="stage-video" className="reveal-up rounded-3xl border border-white/70 bg-white/84 p-6 shadow-[0_16px_45px_rgba(15,23,42,0.08)]" style={{ animationDelay: "140ms" }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{dict.stepTag} 02</p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-900">{dict.video.title}</h2>
                  <p className="mt-2 text-sm text-slate-600">{dict.video.desc}</p>
                </div>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${videoBadge.cls}`}>
                  {videoBadge.text}
                </span>
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{dict.videoModelProvider}</p>
                  {availableVideoProviders.length > 0 ? (
                    <select
                      value={resolvedVideoProviderId}
                      onChange={(event) => setSelectedVideoProviderId(event.target.value)}
                      className={`${inputClass} mt-2`}
                    >
                      {availableVideoProviders.map((provider) => (
                        <option key={`video-provider-${provider.id}`} value={provider.id}>
                          {provider.name} | {provider.selectedModelId || provider.manualModelId || dict.manualModel}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-2 text-xs text-slate-600">
                      {localize(locale, "未发现可用视频模型，请先在", "No video model available. Enable one in ")}
                      <Link href="/settings" className="font-semibold text-teal-700 underline underline-offset-4">
                        {localize(locale, "设置页", "Settings")}
                      </Link>
                      {localize(locale, "启用视频供应商。", ".")}
                    </p>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-700">{dict.video.ratio}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(["9:16", "16:9"] as const).map((ratio) => {
                      const active = renderAspectRatio === ratio;
                      const label = ratio === "9:16" ? dict.video.vertical : dict.video.horizontal;
                      return (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() => setRenderAspectRatio(ratio)}
                          className={`h-11 cursor-pointer rounded-2xl border px-3 text-sm font-semibold transition ${
                            active
                              ? "border-teal-700 bg-teal-700 text-white"
                              : "border-slate-300 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50"
                          }`}
                          aria-pressed={active}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="space-y-1">
                  <span className="text-sm font-semibold text-slate-700">{dict.video.voiceStyle}</span>
                  <input
                    value={voiceStyle}
                    onChange={(event) => setVoiceStyle(event.target.value)}
                    placeholder={dict.video.voiceStylePh}
                    className={inputClass}
                  />
                </label>

                <button
                  type="button"
                  onClick={handleCreateRenderJob}
                  disabled={!scriptId.trim() || renderState.loading}
                  className={primaryButtonClass}
                >
                  {renderState.loading ? dict.video.submitting : dict.video.submit}
                </button>
              </div>

              <p className="mt-3 text-xs text-slate-500">{dict.video.hint}</p>

              {renderJobId ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
                  <p>
                    <span className="font-semibold text-slate-600">{dict.video.jobId}:</span> {renderJobId}
                  </p>
                  <p className="mt-1">
                    <span className="font-semibold text-slate-600">{dict.video.status}:</span> {renderJobStatus || dict.queuedFallback}
                    {isRenderPolling ? ` · ${dict.video.polling}` : ""}
                  </p>
                  {renderProgress ? (
                    <p className="mt-1">
                      <span className="font-semibold text-slate-600">{dict.video.shotStatus}:</span>{" "}
                      {renderProgress.completed}/{renderProgress.total}
                      {renderProgress.failed > 0 ? ` · failed ${renderProgress.failed}` : ""}
                    </p>
                  ) : null}
                  {renderShotStatuses.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      {renderShotStatuses
                        .slice()
                        .sort((a, b) => a.shotIndex - b.shotIndex)
                        .map((shot) => (
                          <p key={`render-shot-status-${shot.shotIndex}`} className="truncate">
                            #{shot.shotIndex}: {shot.status}
                            {shot.errorMessage ? ` · ${shot.errorMessage}` : ""}
                          </p>
                        ))}
                    </div>
                  ) : null}
                  {renderJobStatus === "FAILED" ? (
                    <button
                      type="button"
                      onClick={handleRetryRenderJob}
                      disabled={renderState.loading}
                      className={`${secondaryButtonClass} mt-3`}
                    >
                      {renderState.loading ? dict.video.retrying : dict.video.retry}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {renderJobId && Array.isArray(activeRenderReferenceAssets) && activeRenderReferenceAssets.length > 0 ? (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {localize(locale, "当前成片对应素材", "Assets linked to this video")}
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {activeRenderReferenceAssets.slice(0, 8).map((asset) => (
                      <article key={`render-ref-${asset.id}`} className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                        <button
                          type="button"
                          onClick={() => openImagePreview(asset.url, asset.fileName || asset.id)}
                          className="block w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={asset.url}
                            alt={asset.fileName || asset.id}
                            className="h-20 w-full object-contain"
                          />
                        </button>
                        <p className="mt-1 truncate text-[11px] font-semibold text-slate-700">{asset.fileName || asset.id}</p>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}

              {renderVideoResults.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{dict.video.ready}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {renderVideoResults.slice(0, 8).map((item) => (
                      <article key={`video-preview-${item.id}`} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-2">
                        <button
                          type="button"
                          onClick={() => openVideoPreview(item.url, `${dict.video.jobId}: ${item.id}`)}
                          className="group block w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-900"
                        >
                          <div className="flex aspect-video items-center justify-center">
                            <span className="rounded-full border border-slate-400 px-3 py-1 text-xs font-semibold text-slate-200 transition group-hover:border-teal-300 group-hover:text-teal-200">
                              {localize(locale, "点击播放预览", "Click to preview")}
                            </span>
                          </div>
                        </button>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-800">{item.id}</p>
                            <p className="mt-1 truncate text-[11px] text-slate-500">
                              {new Date(item.updatedAt).toLocaleString(locale)} · {item.status}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => openVideoPreview(item.url, `${dict.video.jobId}: ${item.id}`)}
                            className="shrink-0 text-[11px] font-semibold text-teal-700 underline underline-offset-4"
                          >
                            {localize(locale, "播放", "Play")}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}

              <ResponsePanel heading={dict.responseTitle} state={renderState} empty={dict.responseEmpty} />
            </article>
            ) : null}
          </div>
        </section>
      </main>
      <MediaPreviewDialog preview={previewDialog} locale={locale} onClose={closePreviewDialog} />
    </div>
  );
}
