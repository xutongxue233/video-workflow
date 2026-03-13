"use client";

import { useEffect, useState } from "react";

import { loadProjectScopedConfig, trySaveProjectScopedConfig } from "@/lib/projects/project-scoped-config";

import {
  DEFAULT_GENERATION_PAYLOAD,
  DEFAULT_VOICE_STYLE,
} from "../workspace-copy";
import type { GenerationPayload, Locale } from "../workspace-types";

type UseProjectScopedConfigParams = {
  projectId: string;
  locale: Locale;
};

export function useProjectScopedConfig(params: UseProjectScopedConfigParams) {
  const { projectId, locale } = params;
  const [generationPayload, setGenerationPayload] = useState<GenerationPayload>(DEFAULT_GENERATION_PAYLOAD);
  const [contentLanguage, setContentLanguage] = useState<Locale>("zh-CN");
  const [voiceStyle, setVoiceStyle] = useState(DEFAULT_VOICE_STYLE);
  const [renderAspectRatio, setRenderAspectRatio] = useState<"9:16" | "16:9">("9:16");
  const [selectedTextProviderId, setSelectedTextProviderId] = useState("");
  const [selectedImageProviderId, setSelectedImageProviderId] = useState("");
  const [selectedVideoProviderId, setSelectedVideoProviderId] = useState("");
  const [selectedReferenceAssetIds, setSelectedReferenceAssetIds] = useState<string[]>([]);
  const [hydratedProjectId, setHydratedProjectId] = useState("");

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
        setSelectedImageProviderId("");
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
      setSelectedImageProviderId(saved.selectedImageProviderId);
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
        selectedImageProviderId,
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
    selectedImageProviderId,
    selectedVideoProviderId,
    selectedReferenceAssetIds,
  ]);

  return {
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
  };
}
