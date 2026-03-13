import Link from "next/link";

import type { StoredModelProvider } from "@/lib/models/model-settings.local";

import { localize } from "../workspace-copy";
import type {
  Dict,
  Locale,
  RenderHistoryItem,
  RenderShotStatusItem,
  RenderStatus,
  RequestState,
  StepId,
} from "../workspace-types";
import { toMessageAriaRole, toRenderStatusLabel } from "../workspace-utils";

type VideoResultItem = {
  id: string;
  status: string;
  url: string;
  updatedAt: string;
};

type VideoPanelProps = {
  locale: Locale;
  dict: Dict;
  activeStepId: StepId;
  videoBadge: { text: string; cls: string };
  videoStepIndex: number;
  availableVideoProviders: StoredModelProvider[];
  resolvedVideoProviderId: string;
  renderAspectRatio: "9:16" | "16:9";
  voiceStyle: string;
  renderState: RequestState;
  renderJobId: string;
  renderJobStatus: RenderStatus;
  renderProgress: { completed: number; total: number; failed: number } | null;
  renderShotStatuses: RenderShotStatusItem[];
  activeRenderReferenceAssets: RenderHistoryItem["referenceAssets"];
  renderVideoResults: VideoResultItem[];
  isRenderPolling: boolean;
  videoSubmitDisabledReason: string;
  videoSubmitNeedsSettingsLink: boolean;
  inputClass: string;
  primaryButtonClass: string;
  secondaryButtonClass: string;
  onSelectVideoProvider: (providerId: string) => void;
  onSetRenderAspectRatio: (ratio: "9:16" | "16:9") => void;
  onVoiceStyleChange: (value: string) => void;
  onCreateRenderJob: () => Promise<void>;
  onRetryRenderJob: () => Promise<void>;
  onOpenImagePreview: (url: string, title: string) => void;
  onOpenVideoPreview: (url: string, title: string) => void;
};

export function VideoPanel(props: VideoPanelProps) {
  const {
    locale,
    dict,
    activeStepId,
    videoBadge,
    videoStepIndex,
    availableVideoProviders,
    resolvedVideoProviderId,
    renderAspectRatio,
    voiceStyle,
    renderState,
    renderJobId,
    renderJobStatus,
    renderProgress,
    renderShotStatuses,
    activeRenderReferenceAssets,
    renderVideoResults,
    isRenderPolling,
    videoSubmitDisabledReason,
    videoSubmitNeedsSettingsLink,
    inputClass,
    primaryButtonClass,
    secondaryButtonClass,
    onSelectVideoProvider,
    onSetRenderAspectRatio,
    onVoiceStyleChange,
    onCreateRenderJob,
    onRetryRenderJob,
    onOpenImagePreview,
    onOpenVideoPreview,
  } = props;

  if (activeStepId !== "video") {
    return null;
  }

  return (
    <article id="stage-video" className="wf-panel reveal-up" style={{ animationDelay: "140ms" }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {dict.stepTag} {String(videoStepIndex + 1).padStart(2, "0")}
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">{dict.video.title}</h2>
          <p className="mt-2 text-sm text-slate-600">{dict.video.desc}</p>
        </div>
        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${videoBadge.cls}`}>
          {videoBadge.text}
        </span>
      </div>

      <div className="mt-5 space-y-3">
        <div className="wf-card">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{dict.videoModelProvider}</p>
          {availableVideoProviders.length > 0 ? (
            <select
              value={resolvedVideoProviderId}
              onChange={(event) => onSelectVideoProvider(event.target.value)}
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
                  onClick={() => onSetRenderAspectRatio(ratio)}
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
            onChange={(event) => onVoiceStyleChange(event.target.value)}
            placeholder={dict.video.voiceStylePh}
            className={inputClass}
          />
        </label>

        <button
          type="button"
          onClick={() => void onCreateRenderJob()}
          disabled={Boolean(videoSubmitDisabledReason)}
          className={`${primaryButtonClass} wf-mobile-sticky-btn`}
        >
          {renderState.loading ? dict.video.submitting : dict.video.submit}
        </button>
        {videoSubmitDisabledReason ? (
          <p className="mt-1 text-xs text-slate-500" role="status" aria-live="polite">
            {videoSubmitDisabledReason}{" "}
            {videoSubmitNeedsSettingsLink ? (
              <Link href="/settings" className="font-semibold text-teal-700 underline underline-offset-4">
                {localize(locale, "前往模型配置", "Open model settings")}
              </Link>
            ) : null}
          </p>
        ) : null}
      </div>

      <p className="mt-3 text-xs text-slate-500">{dict.video.hint}</p>

      {renderJobId ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
          <p>
            <span className="font-semibold text-slate-600">{dict.video.status}:</span>{" "}
            {toRenderStatusLabel(locale, renderJobStatus || dict.queuedFallback)}
            {isRenderPolling ? ` · ${dict.video.polling}` : ""}
          </p>
          {renderProgress ? (
            <p className="mt-1">
              <span className="font-semibold text-slate-600">{dict.video.shotStatus}:</span>{" "}
              {renderProgress.completed}/{renderProgress.total}
              {renderProgress.failed > 0
                ? localize(locale, ` · 失败 ${renderProgress.failed}`, ` · failed ${renderProgress.failed}`)
                : ""}
            </p>
          ) : null}
          {renderShotStatuses.length > 0 ? (
            <div className="mt-2 space-y-1">
              {renderShotStatuses
                .slice()
                .sort((a, b) => a.shotIndex - b.shotIndex)
                .map((shot) => (
                  <p key={`render-shot-status-${shot.shotIndex}`} className="truncate">
                    {localize(locale, "分镜", "Shot")} {shot.shotIndex}: {toRenderStatusLabel(locale, shot.status)}
                    {shot.errorMessage ? ` · ${shot.errorMessage}` : ""}
                  </p>
                ))}
            </div>
          ) : null}
          {renderJobStatus === "FAILED" ? (
            <button
              type="button"
              onClick={() => void onRetryRenderJob()}
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
            {activeRenderReferenceAssets.map((asset) => (
              <article key={`render-ref-${asset.id}`} className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                <button
                  type="button"
                  onClick={() => onOpenImagePreview(asset.url, asset.fileName?.trim() || localize(locale, "未命名素材", "Untitled Asset"))}
                  className="block w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.url}
                    alt={asset.fileName?.trim() || localize(locale, "未命名素材", "Untitled Asset")}
                    className="h-20 w-full object-contain"
                  />
                </button>
                <p className="mt-1 truncate text-[11px] font-semibold text-slate-700">
                  {asset.fileName?.trim() || localize(locale, "未命名素材", "Untitled Asset")}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {renderVideoResults.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{dict.video.ready}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {renderVideoResults.slice(0, 8).map((item, index) => (
              <article key={`video-preview-${item.id}`} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-2">
                <button
                  type="button"
                  onClick={() =>
                    onOpenVideoPreview(
                      item.url,
                      localize(
                        locale,
                        `成片预览 ${index + 1}`,
                        `Video Preview ${index + 1}`,
                      ),
                    )
                  }
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
                    <p className="truncate text-xs font-semibold text-slate-800">
                      {localize(locale, "成片预览", "Video Preview")} {index + 1}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-slate-500">
                      {new Date(item.updatedAt).toLocaleString(locale)} · {toRenderStatusLabel(locale, item.status)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenVideoPreview(
                        item.url,
                        localize(
                          locale,
                          `成片预览 ${index + 1}`,
                          `Video Preview ${index + 1}`,
                        ),
                      )
                    }
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

      {renderState.result ? (
        <p className="wf-feedback mt-3" role={toMessageAriaRole(renderState.result)} aria-live="polite">
          {renderState.result}
        </p>
      ) : null}
    </article>
  );
}
