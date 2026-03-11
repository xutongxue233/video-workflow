"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
  buildProjectDetailPath,
  normalizeProjectIdInput,
} from "@/lib/projects/project-navigation";

type Locale = "zh-CN" | "en-US";
type StepId = "asset" | "script" | "video";

type RequestState = { loading: boolean; result: string };
type JsonRecord = Record<string, unknown>;

type GeneratedShot = {
  index: number;
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
  updatedAt: string;
};

type ProjectScopedConfig = {
  generationPayload: {
    productName: string;
    sellingPointsText: string;
    targetAudience: string;
    tone: string;
    durationSec: number;
  };
  contentLanguage: Locale;
  voiceStyle: string;
  renderAspectRatio: "9:16" | "16:9";
  selectedTextProviderId: string;
  selectedVideoProviderId: string;
  selectedReferenceAssetIds: string[];
};

type Dict = {
  localeLabel: string;
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
    ready: string;
  };
};

const LOCALE_KEY = "video-workflow-locale";
const PROJECT_CONFIG_KEY = "video-workflow-project-config-v1";
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

function loadProjectScopedConfig(projectId: string): ProjectScopedConfig | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(PROJECT_CONFIG_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const value = parsed[projectId];
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const config = value as Partial<ProjectScopedConfig>;
    if (!config.generationPayload) {
      return null;
    }

    return {
      generationPayload: {
        productName: config.generationPayload.productName ?? "",
        sellingPointsText: config.generationPayload.sellingPointsText ?? "",
        targetAudience: config.generationPayload.targetAudience ?? "",
        tone: config.generationPayload.tone ?? "",
        durationSec: Number(config.generationPayload.durationSec ?? 30),
      },
      contentLanguage: config.contentLanguage === "en-US" ? "en-US" : "zh-CN",
      voiceStyle: config.voiceStyle ?? DEFAULT_VOICE_STYLE,
      renderAspectRatio: config.renderAspectRatio === "16:9" ? "16:9" : "9:16",
      selectedTextProviderId: config.selectedTextProviderId ?? "",
      selectedVideoProviderId: config.selectedVideoProviderId ?? "",
      selectedReferenceAssetIds: Array.isArray(config.selectedReferenceAssetIds)
        ? config.selectedReferenceAssetIds.filter((item) => typeof item === "string")
        : [],
    };
  } catch {
    return null;
  }
}

function saveProjectScopedConfig(projectId: string, config: ProjectScopedConfig): void {
  if (typeof window === "undefined") {
    return;
  }

  let current: Record<string, unknown> = {};

  try {
    const raw = window.localStorage.getItem(PROJECT_CONFIG_KEY);
    current = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    current = {};
  }

  current[projectId] = config;
  window.localStorage.setItem(PROJECT_CONFIG_KEY, JSON.stringify(current));
}

const TEXT: Record<Locale, Dict> = {
  "zh-CN": {
    localeLabel: "界面语言",
    languages: { "zh-CN": "中文", "en-US": "English" },
    heroTag: "3D 打印短视频流程",
    heroTitle: "OpenAI + SeaDance 创作控制台",
    heroDesc: "从素材到成片的一站式工作流，统一状态反馈和语言切换。",
    completion: "流程完成度",
    uiLang: "界面语言",
    contentLang: "脚本输出语言",
    projectIdLabel: "项目 ID",
    projectIdHint: "同一个项目下的素材、脚本和渲染任务会按该 ID 归档。",
    progressTitle: "执行进度",
    progressHint: "按 1-3 顺序推进，减少返工。",
    quickLang: "快速切换",
    responseTitle: "接口响应",
    responseEmpty: "还没有响应数据。",
    errorPrefix: "请求失败",
    stepTag: "步骤",
    stepNames: {
      asset: "上传素材",
      script: "生成与编辑脚本",
      video: "提交视频生成",
    },
    stepHints: {
      asset: "上传后显示预览。",
      script: "先生成再编辑。",
      video: "有 Script ID 后可入队。",
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
      cta: "CTA",
      save: "保存脚本编辑",
      saving: "保存中...",
      scriptId: "Script ID",
      scriptIdPh: "scr_xxx",
      scriptIdHint: "也可以手动填入已有 Script ID 继续后续流程。",
      needPoints: "请至少填写一个卖点。",
      needScriptId: "请先生成脚本或输入已有 Script ID。",
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
      needScriptId: "缺少 Script ID，无法生成视频。",
      hint: "需要先在步骤 2 获取有效的 Script ID。",
      jobId: "任务 ID",
      status: "任务状态",
      polling: "正在查询任务状态...",
      ready: "视频已生成",
    },
  },
  "en-US": {
    localeLabel: "Interface Language",
    languages: { "zh-CN": "中文", "en-US": "English" },
    heroTag: "3D Print Short-Video Workflow",
    heroTitle: "OpenAI + SeaDance Studio Console",
    heroDesc: "Single-screen workflow from assets to final render with stronger stage feedback.",
    completion: "Workflow Completion",
    uiLang: "Interface Language",
    contentLang: "Script Output Language",
    projectIdLabel: "Project ID",
    projectIdHint: "Assets, scripts, and render jobs are grouped under this project ID.",
    progressTitle: "Progress",
    progressHint: "Complete steps 1-3 in order.",
    quickLang: "Quick Switch",
    responseTitle: "API Response",
    responseEmpty: "No response yet.",
    errorPrefix: "Request failed",
    stepTag: "Step",
    stepNames: {
      asset: "Upload Asset",
      script: "Generate & Edit Script",
      video: "Queue Video Render",
    },
    stepHints: {
      asset: "Preview appears after upload.",
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

function parseSellingPoints(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
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

export default function Home() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const routeProjectIdRaw = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;
  const routeProjectId = normalizeProjectIdInput(decodeURIComponent(routeProjectIdRaw ?? WORKFLOW_DEFAULT_PROJECT_ID));

  const [locale, setLocale] = useState<Locale>("zh-CN");
  const [contentLanguage, setContentLanguage] = useState<Locale>("zh-CN");

  const projectId = routeProjectId;
  const [projectIdDraft, setProjectIdDraft] = useState(routeProjectId);

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
  const [scriptState, setScriptState] = useState<RequestState>({ loading: false, result: "" });

  const [voiceStyle, setVoiceStyle] = useState(DEFAULT_VOICE_STYLE);

  const [renderState, setRenderState] = useState<RequestState>({ loading: false, result: "" });
  const [renderJobId, setRenderJobId] = useState("");
  const [renderJobStatus, setRenderJobStatus] = useState("");
  const [renderVideoUrl, setRenderVideoUrl] = useState("");
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

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem(LOCALE_KEY, locale);
  }, [locale]);

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
        fetch("/api/assets?limit=120"),
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
        ? (toJsonRecord(assetsData).items as MaterialAssetItem[])
        : [];
      const scriptItems = Array.isArray(toJsonRecord(scriptsData).items)
        ? (toJsonRecord(scriptsData).items as ScriptHistoryItem[])
        : [];
      const renderItems = Array.isArray(toJsonRecord(jobsData).items)
        ? (toJsonRecord(jobsData).items as RenderHistoryItem[])
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
        return;
      }

      const saved = loadProjectScopedConfig(normalizedProjectId);
      if (!saved) {
        setGenerationPayload(DEFAULT_GENERATION_PAYLOAD);
        setContentLanguage(locale);
        setVoiceStyle(DEFAULT_VOICE_STYLE);
        setRenderAspectRatio("9:16");
        setSelectedReferenceAssetIds([]);
        return;
      }

      setGenerationPayload(saved.generationPayload);
      setContentLanguage(saved.contentLanguage);
      setVoiceStyle(saved.voiceStyle);
      setRenderAspectRatio(saved.renderAspectRatio);
      setSelectedTextProviderId(saved.selectedTextProviderId);
      setSelectedVideoProviderId(saved.selectedVideoProviderId);
      setSelectedReferenceAssetIds(saved.selectedReferenceAssetIds);
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [projectId, locale]);

  useEffect(() => {
    const normalizedProjectId = projectId.trim();
    if (!normalizedProjectId) {
      return;
    }

    saveProjectScopedConfig(normalizedProjectId, {
      generationPayload,
      contentLanguage,
      voiceStyle,
      renderAspectRatio,
      selectedTextProviderId,
      selectedVideoProviderId,
      selectedReferenceAssetIds,
    });
  }, [
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

        setRenderJobStatus(status);
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
  }, [renderJobId]);

  const dict = TEXT[locale];

  const steps = useMemo<StepView[]>(
    () => [
      { id: "asset", title: dict.stepNames.asset, hint: dict.stepHints.asset, done: Boolean(assetUrl), blocked: false },
      { id: "script", title: dict.stepNames.script, hint: dict.stepHints.script, done: Boolean(scriptId.trim()), blocked: false },
      { id: "video", title: dict.stepNames.video, hint: dict.stepHints.video, done: Boolean(renderJobId), blocked: !scriptId.trim() },
    ],
    [assetUrl, dict, renderJobId, scriptId],
  );

  const completed = useMemo(() => steps.filter((step) => step.done).length, [steps]);
  const progress = useMemo(() => Math.round((completed / steps.length) * 100), [completed, steps.length]);
  const activeStep = useMemo(() => {
    const idx = steps.findIndex((step) => !step.done && !step.blocked);
    if (idx >= 0) {
      return idx;
    }
    const pending = steps.findIndex((step) => !step.done);
    return pending >= 0 ? pending : steps.length - 1;
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
    () => materialLibrary.filter((asset) => selectedReferenceAssetIds.includes(asset.id)),
    [materialLibrary, selectedReferenceAssetIds],
  );
  const currentProjectScripts = useMemo(
    () => scriptHistory.filter((item) => item.projectId === projectId.trim()),
    [scriptHistory, projectId],
  );
  const currentProjectJobs = useMemo(
    () => renderHistory.filter((item) => item.projectId === projectId.trim()),
    [renderHistory, projectId],
  );
  const isRenderPolling = Boolean(renderJobId.trim()) &&
    !["SUCCEEDED", "FAILED", "CANCELED"].includes(renderJobStatus);

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

  function switchProject(nextProjectId: string) {
    const normalized = normalizeProjectIdInput(nextProjectId);
    if (!normalized || normalized === projectId) {
      return;
    }

    setProjectIdDraft(normalized);
    setAssetFile(null);
    setAssetUrl("");
    setScriptId("");
    setRenderJobId("");
    setRenderJobStatus("");
    setRenderVideoUrl("");
    router.push(buildProjectDetailPath(normalized));
  }

  function jumpTo(stepId: StepId) {
    document.getElementById(`stage-${stepId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleEnsureProject() {
    const normalizedProjectId = projectIdDraft.trim();

    if (!normalizedProjectId) {
      return;
    }

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: normalizedProjectId,
        name: normalizedProjectId,
      }),
    });

    const data = toJsonRecord(await readJsonResponse(response));

    if (!response.ok) {
      setWorkspaceState({
        loading: false,
        result: `${dict.errorPrefix} ${response.status}\n${formatJson(data)}`,
      });
      return;
    }

    switchProject(normalizedProjectId);
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
      setAssetUrl(url);
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
        durationSec: Number(generationPayload.durationSec),
        contentLanguage,
        referenceAssets: selectedReferenceAssets.map((asset) => ({
          id: asset.id,
          projectId: asset.projectId,
          fileName: asset.fileName || "unknown",
          url: asset.url,
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
      }

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

  async function handleUpdateScript() {
    if (!scriptId.trim()) {
      setScriptState({ loading: false, result: dict.script.needScriptId });
      return;
    }

    setScriptState({ loading: true, result: dict.script.saving });

    const response = await fetch(`/api/scripts/${scriptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scriptPayload),
    });

    const data = await readJsonResponse(response);

    if (response.ok) {
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

    setRenderVideoUrl("");
    setRenderJobStatus("");
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
      setRenderState({ loading: false, result: formatJson(data) });
      await refreshWorkspace(projectId);
      return;
    }

    setRenderJobId("");
    setRenderState({
      loading: false,
      result: `${dict.errorPrefix} ${response.status}\n${formatJson(data)}`,
    });
  }

  const assetBadge = getBadge(dict, stepMap.asset, activeStep === stepMap.asset.index);
  const scriptBadge = getBadge(dict, stepMap.script, activeStep === stepMap.script.index);
  const videoBadge = getBadge(dict, stepMap.video, activeStep === stepMap.video.index);

  return (
    <div className="min-h-screen pb-20">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-6 md:px-8 lg:pt-8">
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
                模型配置 / Model Settings
              </Link>
              <Link
                href="/"
                className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                返回项目卡片 / Project Cards
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

          <div className="mt-5 grid gap-2 md:grid-cols-[180px_1fr] md:items-center">
            <label htmlFor="projectId" className="text-sm font-semibold text-slate-700">
              {dict.projectIdLabel}
            </label>
            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input id="projectId" value={projectIdDraft} onChange={(event) => setProjectIdDraft(event.target.value)} className={inputClass} />
                <button type="button" onClick={() => switchProject(projectIdDraft)} className={secondaryButtonClass}>
                  {localize(locale, "切换项目", "Switch Project")}
                </button>
                <button type="button" onClick={handleEnsureProject} className={secondaryButtonClass}>
                  {localize(locale, "创建/刷新项目", "Create/Refresh Project")}
                </button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={projectId}
                  onChange={(event) => switchProject(event.target.value)}
                  className={`${inputClass} sm:max-w-md`}
                >
                  <option value={projectId}>{localize(locale, "当前项目", "Current")}: {projectId}</option>
                  {projects
                    .filter((item) => item.id !== projectId)
                    .map((item) => (
                      <option key={`project-opt-${item.id}`} value={item.id}>
                        {item.id} · {item.name}
                      </option>
                    ))}
                </select>
                <button type="button" onClick={() => void refreshWorkspace(projectId)} className={secondaryButtonClass}>
                  {workspaceState.loading ? localize(locale, "刷新中...", "Refreshing...") : localize(locale, "刷新记录", "Refresh Records")}
                </button>
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">{dict.projectIdHint}</p>
          <p className="mt-1 text-xs text-slate-500">{workspaceState.result}</p>
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
                      onClick={() => jumpTo(step.id)}
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
          </aside>

	          <div className="space-y-6">
	            <article className="reveal-up rounded-3xl border border-white/70 bg-white/84 p-6 shadow-[0_16px_45px_rgba(15,23,42,0.08)]">
	              <div className="flex flex-wrap items-start justify-between gap-3">
	                <div>
	                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
	                    {localize(locale, "项目工作区", "Project Workspace")}
	                  </p>
	                  <h2 className="mt-1 text-2xl font-semibold text-slate-900">
	                    {currentProjectSummary?.name || projectId}
	                  </h2>
	                  <p className="mt-2 text-sm text-slate-600">
	                    {localize(
	                      locale,
	                      "同一项目会保留素材、文案、渲染历史与配置。",
	                      "Each project keeps materials, scripts, render history, and configuration.",
	                    )}
	                  </p>
	                </div>
	                <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-slate-700">
	                  {projectId}
	                </span>
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

	              <div className="mt-4 grid gap-3 lg:grid-cols-2">
	                <section className="rounded-2xl border border-slate-200 bg-white p-3">
	                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
	                    {localize(locale, "最近脚本记录", "Recent Scripts")}
	                  </p>
	                  <div className="mt-2 max-h-56 space-y-2 overflow-auto pr-1">
	                    {currentProjectScripts.length > 0 ? (
	                      currentProjectScripts.slice(0, 8).map((item) => (
	                        <button
	                          key={`script-record-${item.id}`}
	                          type="button"
	                          onClick={() => setScriptId(item.id)}
	                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-teal-300 hover:bg-teal-50"
	                        >
	                          <p className="text-xs font-semibold text-slate-800">{item.title || item.id}</p>
	                          <p className="mt-1 text-[11px] text-slate-500">{item.id} · {item.generatorModel || "model n/a"}</p>
	                        </button>
	                      ))
	                    ) : (
	                      <p className="text-xs text-slate-500">{localize(locale, "暂无脚本记录。", "No script records yet.")}</p>
	                    )}
	                  </div>
	                </section>

	                <section className="rounded-2xl border border-slate-200 bg-white p-3">
	                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
	                    {localize(locale, "最近视频任务", "Recent Video Jobs")}
	                  </p>
	                  <div className="mt-2 max-h-56 space-y-2 overflow-auto pr-1">
	                    {currentProjectJobs.length > 0 ? (
	                      currentProjectJobs.slice(0, 8).map((item) => (
	                        <button
	                          key={`job-record-${item.id}`}
	                          type="button"
	                          onClick={() => setRenderJobId(item.id)}
	                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-teal-300 hover:bg-teal-50"
	                        >
	                          <p className="text-xs font-semibold text-slate-800">{item.id}</p>
	                          <p className="mt-1 text-[11px] text-slate-500">
	                            {item.status} · {item.provider || "provider n/a"}
	                          </p>
	                        </button>
	                      ))
	                    ) : (
	                      <p className="text-xs text-slate-500">{localize(locale, "暂无视频任务。", "No render jobs yet.")}</p>
	                    )}
	                  </div>
	                </section>
	              </div>
	            </article>

	            <article className="reveal-up rounded-3xl border border-white/70 bg-white/84 p-6 shadow-[0_16px_45px_rgba(15,23,42,0.08)]" style={{ animationDelay: "20ms" }}>
	              <div className="flex flex-wrap items-start justify-between gap-3">
	                <div>
	                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
	                    {localize(locale, "素材库", "Material Library")}
	                  </p>
	                  <h2 className="mt-1 text-2xl font-semibold text-slate-900">
	                    {localize(locale, "勾选素材作为文案生成参考", "Select materials as script references")}
	                  </h2>
	                  <p className="mt-2 text-sm text-slate-600">
	                    {localize(
	                      locale,
	                      "最多选择 8 个素材。第 2 步生成文案时会把这些素材信息一并发给大模型。",
	                      "Select up to 8 assets. Step 2 sends them to the text model as context.",
	                    )}
	                  </p>
	                </div>
	                <span className="inline-flex rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-teal-700">
	                  {localize(locale, "已选", "Selected")} {selectedReferenceAssets.length}/8
	                </span>
	              </div>

	              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
	                {materialLibrary.slice(0, 24).map((asset) => {
	                  const selected = selectedReferenceAssetIds.includes(asset.id);
	                  return (
	                    <label
	                      key={`material-${asset.id}`}
	                      className={`flex cursor-pointer flex-col gap-2 rounded-2xl border p-3 transition ${
	                        selected
	                          ? "border-teal-400 bg-teal-50/70"
	                          : "border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/50"
	                      }`}
	                    >
	                      <div className="flex items-center justify-between gap-2">
	                        <input
	                          type="checkbox"
	                          checked={selected}
	                          onChange={() => toggleReferenceAsset(asset.id)}
	                          className="h-4 w-4 accent-teal-700"
	                        />
	                        <span className="text-[11px] font-semibold text-slate-500">{asset.projectId}</span>
	                      </div>
	                      {/* eslint-disable-next-line @next/next/no-img-element */}
	                      <img src={asset.url} alt={asset.fileName || asset.id} className="h-28 w-full rounded-xl object-cover" />
	                      <p className="truncate text-xs font-semibold text-slate-800">{asset.fileName || asset.id}</p>
	                    </label>
	                  );
	                })}
	              </div>

	              {materialLibrary.length === 0 ? (
	                <p className="mt-4 text-xs text-slate-500">{localize(locale, "素材库为空，请先上传素材。", "Material library is empty. Upload assets first.")}</p>
	              ) : null}
	            </article>

	            <article id="stage-asset" className="reveal-up rounded-3xl border border-white/70 bg-white/84 p-6 shadow-[0_16px_45px_rgba(15,23,42,0.08)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{dict.stepTag} 01</p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-900">{dict.asset.title}</h2>
                  <p className="mt-2 text-sm text-slate-600">{dict.asset.desc}</p>
                </div>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${assetBadge.cls}`}>
                  {assetBadge.text}
                </span>
              </div>

              <form className="mt-5 grid gap-3" onSubmit={handleUploadAsset}>
                <label htmlFor="asset-file" className="text-sm font-semibold text-slate-700">
                  {dict.asset.fileLabel}
                </label>
                <input
                  id="asset-file"
                  type="file"
                  accept="image/*"
                  onChange={(event) => setAssetFile(event.target.files?.[0] ?? null)}
                  className="block w-full cursor-pointer rounded-2xl border border-slate-300 bg-white p-2.5 text-sm text-slate-700 file:mr-3 file:cursor-pointer file:rounded-xl file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                />
                <button type="submit" disabled={assetState.loading} className={primaryButtonClass}>
                  {assetState.loading ? dict.asset.submitting : dict.asset.submit}
                </button>
              </form>

              {assetUrl ? (
                <figure className="mt-5 rounded-2xl border border-slate-200 bg-white p-3">
                  <figcaption className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{dict.asset.preview}</figcaption>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={assetUrl} alt="Uploaded project asset preview" className="max-h-72 w-full rounded-xl object-cover" />
                </figure>
              ) : null}

              <ResponsePanel heading={dict.responseTitle} state={assetState} empty={dict.responseEmpty} />
            </article>

            <article id="stage-script" className="reveal-up rounded-3xl border border-white/70 bg-white/84 p-6 shadow-[0_16px_45px_rgba(15,23,42,0.08)]" style={{ animationDelay: "60ms" }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{dict.stepTag} 02</p>
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
                      max={180}
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
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Text Model Provider</p>
                  {availableTextProviders.length > 0 ? (
                    <select
                      value={resolvedTextProviderId}
                      onChange={(event) => setSelectedTextProviderId(event.target.value)}
                      className={`${inputClass} mt-2`}
                    >
                      {availableTextProviders.map((provider) => (
                        <option key={`text-provider-${provider.id}`} value={provider.id}>
                          {provider.name} | {provider.selectedModelId || provider.manualModelId || "manual model"}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-2 text-xs text-slate-600">
                      未发现可用文本模型，请先在
                      {" "}
                      <Link href="/settings" className="font-semibold text-teal-700 underline underline-offset-4">
                        设置页
                      </Link>
                      {" "}
                      启用文本供应商。
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

                  <label className="space-y-1">
                    <span className="text-sm font-semibold text-slate-700">{dict.script.storyboard}</span>
                    <textarea
                      value={scriptPayload.storyboard}
                      onChange={(event) =>
                        setScriptPayload((prev) => ({
                          ...prev,
                          storyboard: event.target.value,
                        }))
                      }
                      rows={3}
                      className={textAreaClass}
                    />
                  </label>

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
            <article id="stage-video" className="reveal-up rounded-3xl border border-white/70 bg-white/84 p-6 shadow-[0_16px_45px_rgba(15,23,42,0.08)]" style={{ animationDelay: "140ms" }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{dict.stepTag} 03</p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-900">{dict.video.title}</h2>
                  <p className="mt-2 text-sm text-slate-600">{dict.video.desc}</p>
                </div>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${videoBadge.cls}`}>
                  {videoBadge.text}
                </span>
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Video Model Provider</p>
                  {availableVideoProviders.length > 0 ? (
                    <select
                      value={resolvedVideoProviderId}
                      onChange={(event) => setSelectedVideoProviderId(event.target.value)}
                      className={`${inputClass} mt-2`}
                    >
                      {availableVideoProviders.map((provider) => (
                        <option key={`video-provider-${provider.id}`} value={provider.id}>
                          {provider.name} | {provider.selectedModelId || provider.manualModelId || "manual model"}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-2 text-xs text-slate-600">
                      未发现可用视频模型，请先在
                      {" "}
                      <Link href="/settings" className="font-semibold text-teal-700 underline underline-offset-4">
                        设置页
                      </Link>
                      {" "}
                      启用视频供应商。
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
                    <span className="font-semibold text-slate-600">{dict.video.status}:</span> {renderJobStatus || "QUEUED"}
                    {isRenderPolling ? ` · ${dict.video.polling}` : ""}
                  </p>
                </div>
              ) : null}

              {renderVideoUrl ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{dict.video.ready}</p>
                  <video className="w-full rounded-xl" controls src={renderVideoUrl} />
                  <a
                    href={renderVideoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs font-semibold text-teal-700 underline underline-offset-4"
                  >
                    {renderVideoUrl}
                  </a>
                </div>
              ) : null}

              <ResponsePanel heading={dict.responseTitle} state={renderState} empty={dict.responseEmpty} />
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
