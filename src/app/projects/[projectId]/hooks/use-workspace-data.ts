"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";

import { localize } from "../workspace-copy";
import type {
  Locale,
  MaterialAssetItem,
  ProjectSummaryItem,
  PromptTemplateItem,
  RenderHistoryItem,
  RequestState,
  ScriptHistoryItem,
} from "../workspace-types";
import {
  formatRequestErrorMessage,
  normalizeFileUrl,
  readJsonResponse,
  toJsonRecord,
} from "../workspace-utils";

type UseWorkspaceDataParams = {
  locale: Locale;
  projectId: string;
  setSelectedReferenceAssetIds: Dispatch<SetStateAction<string[]>>;
};

export function useWorkspaceData(params: UseWorkspaceDataParams) {
  const { locale, projectId, setSelectedReferenceAssetIds } = params;
  const [projects, setProjects] = useState<ProjectSummaryItem[]>([]);
  const [materialLibrary, setMaterialLibrary] = useState<MaterialAssetItem[]>([]);
  const [scriptHistory, setScriptHistory] = useState<ScriptHistoryItem[]>([]);
  const [renderHistory, setRenderHistory] = useState<RenderHistoryItem[]>([]);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplateItem[]>([]);
  const [workspaceState, setWorkspaceState] = useState<RequestState>({ loading: false, result: "" });

  const refreshWorkspace = useCallback(async (targetProjectId = projectId) => {
    const normalizedProjectId = targetProjectId.trim();

    if (!normalizedProjectId) {
      setProjects([]);
      setScriptHistory([]);
      setRenderHistory([]);
      setMaterialLibrary([]);
      setPromptTemplates([]);
      return;
    }

    setWorkspaceState({
      loading: true,
      result: localize(locale, "正在刷新项目与素材库...", "Refreshing project workspace..."),
    });

    try {
      const response = await fetch(
        `/api/workspace/${encodeURIComponent(normalizedProjectId)}/overview?projectsLimit=60&assetsLimit=120&scriptsLimit=30&jobsLimit=30&templatesLimit=80`,
      );
      const overviewData = toJsonRecord(await readJsonResponse(response));
      if (!response.ok) {
        setWorkspaceState({
          loading: false,
          result: formatRequestErrorMessage(
            locale,
            response.status,
            "工作区数据加载失败",
            "Failed to load workspace overview",
            overviewData,
          ),
        });
        return;
      }

      const projectItems = Array.isArray(overviewData.projects)
        ? (overviewData.projects as ProjectSummaryItem[])
        : [];
      const materialItems = Array.isArray(overviewData.assets)
        ? (overviewData.assets as MaterialAssetItem[]).map((item) => ({
          ...item,
          url: normalizeFileUrl(item.url),
        }))
        : [];
      const scriptItems = Array.isArray(overviewData.scripts)
        ? (overviewData.scripts as ScriptHistoryItem[])
        : [];
      const renderItems = Array.isArray(overviewData.renderJobs)
        ? (overviewData.renderJobs as RenderHistoryItem[]).map((item) => ({
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
      const templateItems = Array.isArray(overviewData.promptTemplates)
        ? (overviewData.promptTemplates as PromptTemplateItem[])
        : [];

      setProjects(projectItems);
      setMaterialLibrary(materialItems);
      setScriptHistory(scriptItems);
      setRenderHistory(renderItems);
      setPromptTemplates(templateItems);
      setSelectedReferenceAssetIds((prev) => {
        const idSet = new Set(materialItems.map((item) => item.id));
        return prev.filter((id) => idSet.has(id));
      });

      const currentProjectRecord = toJsonRecord(overviewData.project);
      const currentProjectId = typeof currentProjectRecord.id === "string" ? currentProjectRecord.id : "";
      setWorkspaceState({
        loading: false,
        result: localize(
          locale,
          `已加载项目 ${normalizedProjectId}，脚本 ${scriptItems.length} 条，任务 ${renderItems.length} 条，素材库 ${materialItems.length} 条。`,
          `Loaded ${normalizedProjectId}: ${scriptItems.length} scripts, ${renderItems.length} jobs, ${materialItems.length} materials.`,
        ),
      });

      if (!currentProjectId) {
        setWorkspaceState({
          loading: false,
          result: localize(
            locale,
            `项目 ${normalizedProjectId} 不存在或已删除。`,
            `Project ${normalizedProjectId} does not exist or has been deleted.`,
          ),
        });
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
  }, [locale, projectId, setSelectedReferenceAssetIds]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshWorkspace(projectId);
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [projectId, refreshWorkspace]);

  return {
    projects,
    setProjects,
    materialLibrary,
    setMaterialLibrary,
    scriptHistory,
    setScriptHistory,
    renderHistory,
    setRenderHistory,
    promptTemplates,
    setPromptTemplates,
    workspaceState,
    setWorkspaceState,
    refreshWorkspace,
  };
}
