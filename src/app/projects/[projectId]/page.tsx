"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import {
  getSsrSafeInitialModelProviders,
  loadStoredModelProvidersFromLocalStorage,
  toRuntimeImageModelConfig,
  toRuntimeTextModelConfig,
  toRuntimeVideoModelConfig,
  type StoredModelProvider,
} from "@/lib/models/model-settings.local";
import {
  WORKFLOW_DEFAULT_PROJECT_ID,
  normalizeProjectIdInput,
} from "@/lib/projects/project-navigation";
import { REFERENCE_ASSET_SELECTION_LIMIT } from "@/lib/reference-assets.constants";

import { AssetPanel } from "./components/AssetPanel";
import { MediaPreviewDialog } from "./components/MediaPreviewDialog";
import { ScriptPanel } from "./components/ScriptPanel";
import { TimelinePanel } from "./components/TimelinePanel";
import { VideoPanel } from "./components/VideoPanel";
import { WorkflowSidebar } from "./components/WorkflowSidebar";
import { WorkspaceHeader } from "./components/WorkspaceHeader";
import { useProjectScopedConfig } from "./hooks/use-project-scoped-config";
import { useRenderPolling } from "./hooks/use-render-polling";
import { useWorkspaceData } from "./hooks/use-workspace-data";
import { LOCALE_KEY, TEXT, localize } from "./workspace-copy";
import type {
  EditableShot,
  Locale,
  MaterialAssetItem,
  PreviewDialogState,
  RenderHistoryItem,
  RenderShotStatusItem,
  RenderStatus,
  RequestState,
  ScriptJobGroup,
  StepId,
  StepView,
} from "./workspace-types";
import {
  formatRequestErrorMessage,
  generatedShotsToEditableShots,
  getBadge,
  isGeneratedStructuredJson,
  normalizeEditableShots,
  normalizeFileUrl,
  parseSellingPoints,
  parseStoryboardToEditableShots,
  readJsonResponse,
  toAbsoluteFileUrl,
  toGeneratedShotsFromEditableShots,
  toJsonRecord,
  toStoryboardText,
  toStoryboardTextFromEditableShots,
} from "./workspace-utils";

type ScriptPayload = {
  title: string;
  hook: string;
  sellingPoints: string;
  storyboard: string;
  cta: string;
};

export default function Home() {
  const params = useParams<{ projectId: string }>();
  const routeProjectIdRaw = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;
  const routeProjectId = normalizeProjectIdInput(decodeURIComponent(routeProjectIdRaw ?? WORKFLOW_DEFAULT_PROJECT_ID));
  const projectId = routeProjectId;

  const [locale, setLocale] = useState<Locale>("zh-CN");
  const [assetFiles, setAssetFiles] = useState<File[]>([]);
  const [assetInputKey, setAssetInputKey] = useState(0);
  const [assetState, setAssetState] = useState<RequestState>({ loading: false, result: "" });
  const [deletingAssetId, setDeletingAssetId] = useState("");
  const [prototypeAssetFile, setPrototypeAssetFile] = useState<File | null>(null);
  const [referenceGuideFiles, setReferenceGuideFiles] = useState<File[]>([]);
  const [materialPromptInput, setMaterialPromptInput] = useState("");
  const [materialOutputCount, setMaterialOutputCount] = useState(4);
  const [materialOutputSize, setMaterialOutputSize] = useState("");
  const [materialGenState, setMaterialGenState] = useState<RequestState>({ loading: false, result: "" });
  const [selectedPromptTemplateId, setSelectedPromptTemplateId] = useState("");
  const [promptTemplateName, setPromptTemplateName] = useState("");
  const [promptTemplateState, setPromptTemplateState] = useState<RequestState>({ loading: false, result: "" });

  const [scriptId, setScriptId] = useState("");
  const [scriptPayload, setScriptPayload] = useState<ScriptPayload>({
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

  const [renderState, setRenderState] = useState<RequestState>({ loading: false, result: "" });
  const [renderJobId, setRenderJobId] = useState("");
  const [renderJobStatus, setRenderJobStatus] = useState<RenderStatus>("");
  const [renderVideoUrl, setRenderVideoUrl] = useState("");
  const [renderProgress, setRenderProgress] = useState<{ completed: number; total: number; failed: number } | null>(null);
  const [renderShotStatuses, setRenderShotStatuses] = useState<RenderShotStatusItem[]>([]);
  const [activeRenderReferenceAssets, setActiveRenderReferenceAssets] = useState<RenderHistoryItem["referenceAssets"]>([]);
  const [renderPollNonce, setRenderPollNonce] = useState(0);

  const [storedModelProviders, setStoredModelProviders] = useState<StoredModelProvider[]>(() =>
    getSsrSafeInitialModelProviders(),
  );

  const [previewDialog, setPreviewDialog] = useState<PreviewDialogState | null>(null);
  const [preferredStepId, setPreferredStepId] = useState<StepId>("materials");

  const {
    generationPayload,
    setGenerationPayload,
    contentLanguage,
    setContentLanguage,
    voiceStyle,
    setVoiceStyle,
    renderAspectRatio,
    setRenderAspectRatio,
    selectedTextProviderId,
    setSelectedTextProviderId,
    selectedImageProviderId,
    setSelectedImageProviderId,
    selectedVideoProviderId,
    setSelectedVideoProviderId,
    selectedReferenceAssetIds,
    setSelectedReferenceAssetIds,
  } = useProjectScopedConfig({ projectId, locale });

  const {
    projects,
    materialLibrary,
    setMaterialLibrary,
    scriptHistory,
    renderHistory,
    promptTemplates,
    workspaceState,
    refreshWorkspace,
  } = useWorkspaceData({ locale, projectId, setSelectedReferenceAssetIds });

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

  useRenderPolling({
    locale,
    renderJobId,
    renderPollNonce,
    setRenderJobStatus,
    setRenderVideoUrl,
    setRenderProgress,
    setRenderShotStatuses,
    setActiveRenderReferenceAssets,
    setRenderState,
  });

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
      {
        id: "materials",
        title: dict.stepNames.materials,
        hint: dict.stepHints.materials,
        criteria: localize(
          locale,
          `完成标准：素材 >= 1（当前 ${materialLibrary.length}）`,
          `Done when assets >= 1 (now ${materialLibrary.length})`,
        ),
        done: materialLibrary.length > 0,
        blocked: false,
      },
      {
        id: "script",
        title: dict.stepNames.script,
        hint: dict.stepHints.script,
        criteria: localize(
          locale,
          `完成标准：已生成脚本 ID（当前 ${scriptId.trim() ? "已存在" : "未生成"}）`,
          `Done when script ID exists (now ${scriptId.trim() ? "ready" : "missing"})`,
        ),
        done: Boolean(scriptId.trim()),
        blocked: false,
      },
      {
        id: "video",
        title: dict.stepNames.video,
        hint: dict.stepHints.video,
        criteria: localize(
          locale,
          `完成标准：已提交渲染任务（当前 ${renderJobId ? "已提交" : "未提交"}）`,
          `Done when render job is submitted (now ${renderJobId ? "submitted" : "not submitted"})`,
        ),
        done: Boolean(renderJobId),
        blocked: !scriptId.trim(),
      },
    ],
    [dict, locale, materialLibrary.length, renderJobId, scriptId],
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
  const availableImageProviders = useMemo(
    () =>
      storedModelProviders.filter(
        (provider) => provider.enabled && provider.capability === "image" && Boolean(toRuntimeImageModelConfig(provider)),
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
  const resolvedImageProviderId = useMemo(
    () =>
      availableImageProviders.some((provider) => provider.id === selectedImageProviderId)
        ? selectedImageProviderId
        : (availableImageProviders[0]?.id ?? ""),
    [availableImageProviders, selectedImageProviderId],
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
  const selectedImageProvider = useMemo(
    () => availableImageProviders.find((provider) => provider.id === resolvedImageProviderId) ?? null,
    [availableImageProviders, resolvedImageProviderId],
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

  const scriptJobGroups = useMemo<ScriptJobGroup[]>(() => {
    const jobsByScript = new Map<string, RenderHistoryItem[]>();
    for (const job of currentProjectJobs) {
      const key = job.scriptId?.trim() || "__unspecified__";
      const list = jobsByScript.get(key) ?? [];
      list.push(job);
      jobsByScript.set(key, list);
    }

    const groups: ScriptJobGroup[] = currentProjectScripts.map((script) => {
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
    for (const [scriptIdValue, jobs] of jobsByScript.entries()) {
      if (scriptIdValue === "__unspecified__" || linkedScriptIds.has(scriptIdValue)) {
        continue;
      }
      groups.push({
        key: `missing-${scriptIdValue}`,
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

  const inputClass = "wf-input";
  const textAreaClass = "wf-textarea";
  const primaryButtonClass = "wf-btn-primary";
  const secondaryButtonClass = "wf-btn-secondary";

  const hasScriptSellingPoints = useMemo(
    () => parseSellingPoints(generationPayload.sellingPointsText).length > 0,
    [generationPayload.sellingPointsText],
  );
  const imageProviderMissing = !selectedImageProvider;
  const textProviderMissing = !selectedTextProvider;
  const videoProviderMissing = !selectedVideoProvider;
  const materialGenerateDisabledReason = useMemo(() => {
    if (materialGenState.loading) {
      return localize(locale, "素材生成进行中...", "Material generation in progress...");
    }
    if (imageProviderMissing) {
      return localize(locale, "未配置图像模型。", "No image model configured.");
    }
    if (!prototypeAssetFile) {
      return dict.materialGen.needPrototype;
    }
    if (!materialPromptInput.trim()) {
      return dict.materialGen.needPrompt;
    }
    return "";
  }, [
    dict.materialGen.needPrompt,
    dict.materialGen.needPrototype,
    imageProviderMissing,
    locale,
    materialGenState.loading,
    materialPromptInput,
    prototypeAssetFile,
  ]);
  const scriptGenerateDisabledReason = useMemo(() => {
    if (scriptState.loading) {
      return localize(locale, "脚本生成进行中...", "Script generation in progress...");
    }
    if (textProviderMissing) {
      return localize(locale, "未配置文本模型。", "No text model configured.");
    }
    if (!hasScriptSellingPoints) {
      return dict.script.needPoints;
    }
    return "";
  }, [dict.script.needPoints, hasScriptSellingPoints, locale, scriptState.loading, textProviderMissing]);
  const videoSubmitDisabledReason = useMemo(() => {
    if (renderState.loading) {
      return localize(locale, "视频任务提交中...", "Submitting render job...");
    }
    if (videoProviderMissing) {
      return localize(locale, "未配置视频模型。", "No video model configured.");
    }
    if (!scriptId.trim()) {
      return dict.video.needScriptId;
    }
    return "";
  }, [dict.video.needScriptId, locale, renderState.loading, scriptId, videoProviderMissing]);

  function switchLocale(next: Locale) {
    setLocale(next);
    setContentLanguage(next);
  }

  function toggleReferenceAsset(assetId: string) {
    setSelectedReferenceAssetIds((prev) => {
      if (prev.includes(assetId)) {
        return prev.filter((id) => id !== assetId);
      }

      if (prev.length >= REFERENCE_ASSET_SELECTION_LIMIT) {
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

  async function uploadAssetFiles(files: File[]): Promise<{
    created: MaterialAssetItem[];
    failures: Array<{ fileName: string }>;
  }> {
    const created: MaterialAssetItem[] = [];
    const failures: Array<{ fileName: string }> = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append("projectId", projectId);
      formData.append("file", file);

      const response = await fetch("/api/assets", { method: "POST", body: formData });
      const data = toJsonRecord(await readJsonResponse(response));
      if (!response.ok) {
        failures.push({ fileName: file.name });
        continue;
      }

      if (
        typeof data.id === "string"
        && typeof data.projectId === "string"
        && typeof data.url === "string"
      ) {
        created.push({
          id: data.id,
          projectId: data.projectId,
          fileName: typeof data.fileName === "string" ? data.fileName : null,
          url: normalizeFileUrl(data.url),
          createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
        });
      }
    }

    return { created, failures };
  }

  async function handleDeleteAsset(assetId: string) {
    const normalizedProjectId = projectId.trim();
    if (!normalizedProjectId || !assetId.trim()) {
      return;
    }

    setDeletingAssetId(assetId);
    try {
      const response = await fetch(
        `/api/assets/${encodeURIComponent(assetId)}?projectId=${encodeURIComponent(normalizedProjectId)}`,
        { method: "DELETE" },
      );
      const data = toJsonRecord(await readJsonResponse(response));
      if (!response.ok) {
        setAssetState({
          loading: false,
          result: formatRequestErrorMessage(locale, response.status, "素材移除失败", "Failed to remove asset", data),
        });
        return;
      }

      setMaterialLibrary((prev) => prev.filter((asset) => asset.id !== assetId));
      setSelectedReferenceAssetIds((prev) => prev.filter((id) => id !== assetId));
      setAssetState({
        loading: false,
        result: localize(locale, "素材已移除。", "Asset removed."),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "failed";
      setAssetState({
        loading: false,
        result: localize(locale, `素材移除失败：${message}`, `Failed to remove asset: ${message}`),
      });
    } finally {
      setDeletingAssetId("");
    }
  }

  async function handleUploadAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (assetFiles.length === 0) {
      setAssetState({ loading: false, result: dict.asset.chooseFile });
      return;
    }

    setAssetState({ loading: true, result: dict.asset.submitting });

    const { created, failures } = await uploadAssetFiles(assetFiles);
    const uploadedIds = created.map((item) => item.id);

    if (uploadedIds.length > 0) {
      setSelectedReferenceAssetIds((prev) => {
        const next = [...prev];
        for (const assetId of uploadedIds) {
          if (next.includes(assetId)) {
            continue;
          }
          if (next.length >= REFERENCE_ASSET_SELECTION_LIMIT) {
            break;
          }
          next.push(assetId);
        }
        return next;
      });
    }

    setAssetFiles([]);
    setAssetInputKey((prev) => prev + 1);
    await refreshWorkspace(projectId);

    if (failures.length === 0) {
      setAssetState({
        loading: false,
        result: localize(
          locale,
          `上传完成：${uploadedIds.length}/${assetFiles.length} 个素材。`,
          `Upload completed: ${uploadedIds.length}/${assetFiles.length} asset(s).`,
        ),
      });
      return;
    }

    const failurePreview = failures
      .slice(0, 2)
      .map((item) => item.fileName)
      .join(localize(locale, "、", ", "));
    const failureSuffix = failures.length > 2 ? localize(locale, "等", " and more") : "";
    setAssetState({
      loading: false,
      result: localize(
        locale,
        `上传完成：成功 ${uploadedIds.length}，失败 ${failures.length}${failurePreview ? `（${failurePreview}${failureSuffix}）` : ""}。`,
        `Upload completed: ${uploadedIds.length} succeeded, ${failures.length} failed${failurePreview ? ` (${failurePreview}${failureSuffix})` : ""}.`,
      ),
    });
  }

  async function handleSavePromptTemplate() {
    if (!promptTemplateName.trim() || !materialPromptInput.trim()) {
      setPromptTemplateState({
        loading: false,
        result: localize(locale, "模板名称和提示词不能为空。", "Template name and prompt are required."),
      });
      return;
    }

    setPromptTemplateState({ loading: true, result: dict.materialGen.savingTemplate });
    const response = await fetch("/api/prompt-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        name: promptTemplateName.trim(),
        prompt: materialPromptInput.trim(),
      }),
    });
    const data = toJsonRecord(await readJsonResponse(response));
    if (!response.ok) {
      setPromptTemplateState({
        loading: false,
        result: formatRequestErrorMessage(locale, response.status, "保存模板失败", "Failed to save template", data),
      });
      return;
    }

    const createdId = typeof data.id === "string" ? data.id : "";
    setPromptTemplateName("");
    await refreshWorkspace(projectId);
    if (createdId) {
      setSelectedPromptTemplateId(createdId);
    }
    setPromptTemplateState({
      loading: false,
      result: localize(locale, "模板已保存。", "Template saved."),
    });
  }

  async function handleGenerateMaterialImages() {
    if (!prototypeAssetFile) {
      setMaterialGenState({ loading: false, result: dict.materialGen.needPrototype });
      return;
    }
    if (!materialPromptInput.trim()) {
      setMaterialGenState({ loading: false, result: dict.materialGen.needPrompt });
      return;
    }

    setMaterialGenState({ loading: true, result: dict.materialGen.submitting });
    const runtimeImageModel = selectedImageProvider ? toRuntimeImageModelConfig(selectedImageProvider) : null;
    if (!runtimeImageModel) {
      setMaterialGenState({
        loading: false,
        result: localize(
          locale,
          "未找到可用图像模型，请先在设置页启用并选择 Seedream 模型。",
          "No image model is selected. Enable and select a Seedream model in Settings first.",
        ),
      });
      return;
    }

    const prototypeUpload = await uploadAssetFiles([prototypeAssetFile]);
    const prototypeAssetId = prototypeUpload.created[0]?.id ?? "";
    if (!prototypeAssetId) {
      setMaterialGenState({
        loading: false,
        result: localize(locale, "原型图上传失败，请重试。", "Failed to upload prototype image."),
      });
      return;
    }

    const referenceUpload = referenceGuideFiles.length > 0
      ? await uploadAssetFiles(referenceGuideFiles)
      : { created: [], failures: [] as Array<{ fileName: string }> };

    const response = await fetch("/api/images/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        prompt: materialPromptInput.trim(),
        outputCount: materialOutputCount,
        size: materialOutputSize.trim() || undefined,
        prototypeAssetId,
        referenceAssetIds: referenceUpload.created.map((item) => item.id),
        selectedImageModel: runtimeImageModel,
      }),
    });
    const data = toJsonRecord(await readJsonResponse(response));

    if (!response.ok) {
      setMaterialGenState({
        loading: false,
        result: formatRequestErrorMessage(locale, response.status, "素材生成失败", "Failed to generate materials", data),
      });
      return;
    }

    const generatedItems = Array.isArray(data.items) ? (data.items as MaterialAssetItem[]) : [];
    if (generatedItems.length > 0) {
      setSelectedReferenceAssetIds((prev) => {
        const next = [...prev];
        for (const item of generatedItems) {
          if (next.includes(item.id)) {
            continue;
          }
          if (next.length >= REFERENCE_ASSET_SELECTION_LIMIT) {
            break;
          }
          next.push(item.id);
        }
        return next;
      });
    }

    setPrototypeAssetFile(null);
    setReferenceGuideFiles([]);
    await refreshWorkspace(projectId);
    const failedReferenceCount = referenceUpload.failures.length;
    setMaterialGenState({
      loading: false,
      result: localize(
        locale,
        `${dict.materialGen.generated} ${generatedItems.length} 张${failedReferenceCount > 0 ? `，参考图上传失败 ${failedReferenceCount} 张` : ""}。`,
        `${dict.materialGen.generated} ${generatedItems.length} image(s)${failedReferenceCount > 0 ? `, ${failedReferenceCount} reference upload(s) failed` : ""}.`,
      ),
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
      setScriptState({
        loading: false,
        result: localize(locale, "脚本生成成功，可继续编辑。", "Script generated. You can edit it now."),
      });
      await refreshWorkspace(projectId);
      return;
    }

    setScriptState({
      loading: false,
      result: formatRequestErrorMessage(
        locale,
        response.status,
        "脚本生成失败",
        "Failed to generate script",
        data,
      ),
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
        referenceAssetIds: selectedReferenceAssets.map((asset) => asset.id),
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
        result: localize(locale, "已根据素材自动填充参数。", "Fields were auto-filled from selected assets."),
      });
      return;
    }

    setScriptState({
      loading: false,
      result: formatRequestErrorMessage(
        locale,
        response.status,
        "自动填充失败",
        "Auto-fill failed",
        data,
      ),
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
      setScriptState({
        loading: false,
        result: localize(locale, "脚本已保存。", "Script saved."),
      });
      await refreshWorkspace(projectId);
      return;
    }

    setScriptState({
      loading: false,
      result: formatRequestErrorMessage(
        locale,
        response.status,
        "保存脚本失败",
        "Failed to save script",
        data,
      ),
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
        referenceAssetIds: selectedReferenceAssets.map((asset) => asset.id),
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
      setRenderState({
        loading: false,
        result: localize(locale, "任务已提交，正在生成。", "Render job queued and processing."),
      });
      await refreshWorkspace(projectId);
      return;
    }

    setRenderJobId("");
    setRenderProgress(null);
    setRenderShotStatuses([]);
    setActiveRenderReferenceAssets([]);
    setRenderState({
      loading: false,
      result: formatRequestErrorMessage(
        locale,
        response.status,
        "提交任务失败",
        "Failed to submit render job",
        data,
      ),
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
        referenceAssetIds: selectedReferenceAssets.map((asset) => asset.id),
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
      setRenderState({
        loading: false,
        result: localize(locale, "重试任务已提交。", "Retry request submitted."),
      });
      await refreshWorkspace(projectId);
      return;
    }

    setRenderState({
      loading: false,
      result: formatRequestErrorMessage(
        locale,
        response.status,
        "重试失败",
        "Retry failed",
        data,
      ),
    });
  }

  const handleSelectPromptTemplate = useCallback((templateId: string) => {
    setSelectedPromptTemplateId(templateId);
    const template = promptTemplates.find((item) => item.id === templateId);
    if (template) {
      setMaterialPromptInput(template.prompt);
    }
  }, [promptTemplates]);

  const handleTimelineSelectScript = useCallback((selectedScriptId: string) => {
    setScriptId(selectedScriptId);
    setPreferredStepId("script");
  }, []);

  const handleTimelineSelectRenderJob = useCallback((job: RenderHistoryItem) => {
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
  }, []);

  const scriptBadge = getBadge(dict, stepMap.script, activeStep === stepMap.script.index);
  const videoBadge = getBadge(dict, stepMap.video, activeStep === stepMap.video.index);

  return (
    <div className="min-h-screen overflow-x-hidden pb-20">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 overflow-x-hidden px-4 pt-6 md:px-8 lg:pt-8">
        <WorkspaceHeader
          locale={locale}
          dict={dict}
          contentLanguage={contentLanguage}
          projectId={projectId}
          currentProjectName={currentProjectSummary?.name || currentProjectSummary?.id || null}
          completed={completed}
          stepCount={steps.length}
          progress={progress}
          workspaceMessage={workspaceState.result}
          onSwitchLocale={switchLocale}
        />

        <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <WorkflowSidebar
            locale={locale}
            dict={dict}
            steps={steps}
            activeStepIndex={activeStep}
            progress={progress}
            onSelectStep={setPreferredStepId}
            onSwitchLocale={switchLocale}
          />

          <div className="min-w-0 space-y-6">
            <AssetPanel
              locale={locale}
              dict={dict}
              activeStepId={activeStepId}
              activeStepIndex={activeStep}
              materialsStep={stepMap.materials}
              currentProjectSummary={currentProjectSummary}
              selectedReferenceAssetIds={selectedReferenceAssetIds}
              selectedReferenceAssets={selectedReferenceAssets}
              materialLibrary={materialLibrary}
              deletingAssetId={deletingAssetId}
              assetInputKey={assetInputKey}
              assetState={assetState}
              promptTemplates={promptTemplates}
              selectedPromptTemplateId={selectedPromptTemplateId}
              promptTemplateName={promptTemplateName}
              materialPromptInput={materialPromptInput}
              prototypeAssetFile={prototypeAssetFile}
              referenceGuideFiles={referenceGuideFiles}
              materialOutputCount={materialOutputCount}
              materialOutputSize={materialOutputSize}
              promptTemplateState={promptTemplateState}
              materialGenState={materialGenState}
              materialGenerateDisabledReason={materialGenerateDisabledReason}
              materialGenerateNeedsSettingsLink={imageProviderMissing}
              availableImageProviders={availableImageProviders}
              resolvedImageProviderId={resolvedImageProviderId}
              inputClass={inputClass}
              textAreaClass={textAreaClass}
              primaryButtonClass={primaryButtonClass}
              secondaryButtonClass={secondaryButtonClass}
              onClearReferenceSelection={() => setSelectedReferenceAssetIds([])}
              onUploadAsset={handleUploadAsset}
              onAssetFilesChange={setAssetFiles}
              onToggleReferenceAsset={toggleReferenceAsset}
              onOpenImagePreview={openImagePreview}
              onDeleteAsset={handleDeleteAsset}
              onSelectImageProvider={setSelectedImageProviderId}
              onSelectPromptTemplate={handleSelectPromptTemplate}
              onPromptTemplateNameChange={setPromptTemplateName}
              onMaterialPromptChange={setMaterialPromptInput}
              onPrototypeFileChange={setPrototypeAssetFile}
              onReferenceGuideFilesChange={setReferenceGuideFiles}
              onMaterialOutputCountChange={setMaterialOutputCount}
              onMaterialOutputSizeChange={setMaterialOutputSize}
              onSavePromptTemplate={handleSavePromptTemplate}
              onGenerateMaterialImages={handleGenerateMaterialImages}
            />

            <ScriptPanel
              locale={locale}
              dict={dict}
              activeStepId={activeStepId}
              scriptBadge={scriptBadge}
              scriptStepIndex={stepMap.script.index}
              generationPayload={generationPayload}
              contentLanguage={contentLanguage}
              scriptPayload={scriptPayload}
              scriptShots={scriptShots}
              scriptId={scriptId}
              selectedReferenceAssets={selectedReferenceAssets}
              scriptState={scriptState}
              scriptGenerateDisabledReason={scriptGenerateDisabledReason}
              scriptGenerateNeedsSettingsLink={textProviderMissing}
              availableTextProviders={availableTextProviders}
              resolvedTextProviderId={resolvedTextProviderId}
              inputClass={inputClass}
              textAreaClass={textAreaClass}
              primaryButtonClass={primaryButtonClass}
              secondaryButtonClass={secondaryButtonClass}
              onGenerateScript={handleGenerateScript}
              onAutoFillScriptInputs={handleAutoFillScriptInputs}
              onUpdateScript={handleUpdateScript}
              onSelectTextProvider={setSelectedTextProviderId}
              onProductNameChange={(value) => setGenerationPayload((prev) => ({ ...prev, productName: value }))}
              onTargetAudienceChange={(value) => setGenerationPayload((prev) => ({ ...prev, targetAudience: value }))}
              onSellingPointsTextChange={(value) => setGenerationPayload((prev) => ({ ...prev, sellingPointsText: value }))}
              onToneChange={(value) => setGenerationPayload((prev) => ({ ...prev, tone: value }))}
              onDurationChange={(value) => setGenerationPayload((prev) => ({ ...prev, durationSec: value }))}
              onContentLanguageChange={setContentLanguage}
              onScriptTitleChange={(value) => setScriptPayload((prev) => ({ ...prev, title: value }))}
              onScriptHookChange={(value) => setScriptPayload((prev) => ({ ...prev, hook: value }))}
              onScriptSellingPointsChange={(value) => setScriptPayload((prev) => ({ ...prev, sellingPoints: value }))}
              onScriptCtaChange={(value) => setScriptPayload((prev) => ({ ...prev, cta: value }))}
              onScriptIdChange={setScriptId}
              onAddShot={addShot}
              onRemoveShot={removeShot}
              onUpdateShotField={updateShotField}
            />

            <VideoPanel
              locale={locale}
              dict={dict}
              activeStepId={activeStepId}
              videoBadge={videoBadge}
              videoStepIndex={stepMap.video.index}
              availableVideoProviders={availableVideoProviders}
              resolvedVideoProviderId={resolvedVideoProviderId}
              renderAspectRatio={renderAspectRatio}
              voiceStyle={voiceStyle}
              renderState={renderState}
              renderJobId={renderJobId}
              renderJobStatus={renderJobStatus}
              renderProgress={renderProgress}
              renderShotStatuses={renderShotStatuses}
              activeRenderReferenceAssets={activeRenderReferenceAssets}
              renderVideoResults={renderVideoResults}
              isRenderPolling={isRenderPolling}
              videoSubmitDisabledReason={videoSubmitDisabledReason}
              videoSubmitNeedsSettingsLink={videoProviderMissing}
              inputClass={inputClass}
              primaryButtonClass={primaryButtonClass}
              secondaryButtonClass={secondaryButtonClass}
              onSelectVideoProvider={setSelectedVideoProviderId}
              onSetRenderAspectRatio={setRenderAspectRatio}
              onVoiceStyleChange={setVoiceStyle}
              onCreateRenderJob={handleCreateRenderJob}
              onRetryRenderJob={handleRetryRenderJob}
              onOpenImagePreview={openImagePreview}
              onOpenVideoPreview={openVideoPreview}
            />

            <TimelinePanel
              locale={locale}
              dict={dict}
              scriptJobGroups={scriptJobGroups}
              onLoadScript={handleTimelineSelectScript}
              onSelectRenderJob={handleTimelineSelectRenderJob}
            />
          </div>
        </section>
      </main>
      <MediaPreviewDialog preview={previewDialog} locale={locale} onClose={closePreviewDialog} />
    </div>
  );
}
