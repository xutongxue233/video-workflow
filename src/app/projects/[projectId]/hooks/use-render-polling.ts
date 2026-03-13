"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";

import { localize } from "../workspace-copy";
import type {
  Locale,
  RenderHistoryItem,
  RenderShotStatusItem,
  RenderStatus,
  RequestState,
} from "../workspace-types";
import {
  formatRequestErrorMessage,
  normalizeFileUrl,
  readJsonResponse,
  toJsonRecord,
} from "../workspace-utils";

type UseRenderPollingParams = {
  locale: Locale;
  renderJobId: string;
  renderPollNonce: number;
  setRenderJobStatus: Dispatch<SetStateAction<RenderStatus>>;
  setRenderVideoUrl: Dispatch<SetStateAction<string>>;
  setRenderProgress: Dispatch<SetStateAction<{ completed: number; total: number; failed: number } | null>>;
  setRenderShotStatuses: Dispatch<SetStateAction<RenderShotStatusItem[]>>;
  setActiveRenderReferenceAssets: Dispatch<SetStateAction<RenderHistoryItem["referenceAssets"]>>;
  setRenderState: Dispatch<SetStateAction<RequestState>>;
};

export function useRenderPolling(params: UseRenderPollingParams) {
  const {
    locale,
    renderJobId,
    renderPollNonce,
    setRenderJobStatus,
    setRenderVideoUrl,
    setRenderProgress,
    setRenderShotStatuses,
    setActiveRenderReferenceAssets,
    setRenderState,
  } = params;

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
            result: formatRequestErrorMessage(
              locale,
              response.status,
              "任务状态查询失败，可稍后重试",
              "Failed to refresh job status. Try again later",
              data,
            ),
          });
          setRenderJobStatus("FAILED");
          return;
        }

        const status = typeof data.status === "string" ? data.status : "";
        const videoUrl = typeof data.videoUrl === "string" ? data.videoUrl : "";
        const progress =
          data.progress && typeof data.progress === "object"
            ? {
              completed: Number((data.progress as Record<string, unknown>).completed ?? 0),
              total: Number((data.progress as Record<string, unknown>).total ?? 0),
              failed: Number((data.progress as Record<string, unknown>).failed ?? 0),
            }
            : null;
        const shotStatuses = Array.isArray(data.shotStatuses)
          ? data.shotStatuses
            .map((item) => ({
              shotIndex: Number((item as Record<string, unknown>).shotIndex ?? 0),
              status: typeof (item as Record<string, unknown>).status === "string" ? (item as Record<string, unknown>).status as string : "",
              errorMessage:
                typeof (item as Record<string, unknown>).errorMessage === "string"
                  ? (item as Record<string, unknown>).errorMessage as string
                  : undefined,
            }))
            .filter((item) => Number.isFinite(item.shotIndex) && item.shotIndex > 0 && item.status.length > 0)
          : [];
        const polledReferenceAssets = Array.isArray(data.referenceAssets)
          ? data.referenceAssets
            .map((item) => {
              const record = item as Record<string, unknown>;
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
        setRenderState({
          loading: false,
          result: terminalStatus.has(status)
            ? localize(locale, "任务状态已结束。", "Render task finished.")
            : localize(locale, "正在查询任务状态...", "Polling render status..."),
        });

        if (videoUrl) {
          setRenderVideoUrl(videoUrl);
        }

        if (terminalStatus.has(status)) {
          return;
        }

        scheduleNextPoll();
      } catch {
        setRenderState({
          loading: false,
          result: localize(
            locale,
            "任务状态刷新失败，系统将自动重试。",
            "Failed to refresh render status. The system will retry automatically.",
          ),
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
  }, [
    locale,
    renderJobId,
    renderPollNonce,
    setActiveRenderReferenceAssets,
    setRenderJobStatus,
    setRenderProgress,
    setRenderShotStatuses,
    setRenderState,
    setRenderVideoUrl,
  ]);
}
