import Link from "next/link";
import type { FormEvent } from "react";

import { REFERENCE_ASSET_SELECTION_LIMIT } from "@/lib/reference-assets.constants";
import type { StoredModelProvider } from "@/lib/models/model-settings.local";

import { localize } from "../workspace-copy";
import type {
  Dict,
  Locale,
  MaterialAssetItem,
  PromptTemplateItem,
  ProjectSummaryItem,
  RequestState,
  StepId,
  StepView,
} from "../workspace-types";
import { getBadge, toMessageAriaRole } from "../workspace-utils";

type AssetPanelProps = {
  locale: Locale;
  dict: Dict;
  activeStepId: StepId;
  activeStepIndex: number;
  materialsStep: StepView & { index: number };
  currentProjectSummary: ProjectSummaryItem | null;
  selectedReferenceAssetIds: string[];
  selectedReferenceAssets: MaterialAssetItem[];
  materialLibrary: MaterialAssetItem[];
  deletingAssetId: string;
  assetInputKey: number;
  assetState: RequestState;
  promptTemplates: PromptTemplateItem[];
  selectedPromptTemplateId: string;
  promptTemplateName: string;
  materialPromptInput: string;
  prototypeAssetFile: File | null;
  referenceGuideFiles: File[];
  materialOutputCount: number;
  materialOutputSize: string;
  promptTemplateState: RequestState;
  materialGenState: RequestState;
  materialGenerateDisabledReason: string;
  materialGenerateNeedsSettingsLink: boolean;
  availableImageProviders: StoredModelProvider[];
  resolvedImageProviderId: string;
  inputClass: string;
  textAreaClass: string;
  primaryButtonClass: string;
  secondaryButtonClass: string;
  onClearReferenceSelection: () => void;
  onUploadAsset: (event: FormEvent<HTMLFormElement>) => void;
  onAssetFilesChange: (files: File[]) => void;
  onToggleReferenceAsset: (assetId: string) => void;
  onOpenImagePreview: (url: string, title: string) => void;
  onDeleteAsset: (assetId: string) => Promise<void>;
  onSelectImageProvider: (providerId: string) => void;
  onSelectPromptTemplate: (templateId: string) => void;
  onPromptTemplateNameChange: (value: string) => void;
  onMaterialPromptChange: (value: string) => void;
  onPrototypeFileChange: (file: File | null) => void;
  onReferenceGuideFilesChange: (files: File[]) => void;
  onMaterialOutputCountChange: (value: number) => void;
  onMaterialOutputSizeChange: (value: string) => void;
  onSavePromptTemplate: () => Promise<void>;
  onGenerateMaterialImages: () => Promise<void>;
};

export function AssetPanel(props: AssetPanelProps) {
  const {
    locale,
    dict,
    activeStepId,
    activeStepIndex,
    materialsStep,
    currentProjectSummary,
    selectedReferenceAssetIds,
    selectedReferenceAssets,
    materialLibrary,
    deletingAssetId,
    assetInputKey,
    assetState,
    promptTemplates,
    selectedPromptTemplateId,
    promptTemplateName,
    materialPromptInput,
    prototypeAssetFile,
    referenceGuideFiles,
    materialOutputCount,
    materialOutputSize,
    promptTemplateState,
    materialGenState,
    materialGenerateDisabledReason,
    materialGenerateNeedsSettingsLink,
    availableImageProviders,
    resolvedImageProviderId,
    inputClass,
    textAreaClass,
    primaryButtonClass,
    secondaryButtonClass,
    onClearReferenceSelection,
    onUploadAsset,
    onAssetFilesChange,
    onToggleReferenceAsset,
    onOpenImagePreview,
    onDeleteAsset,
    onSelectImageProvider,
    onSelectPromptTemplate,
    onPromptTemplateNameChange,
    onMaterialPromptChange,
    onPrototypeFileChange,
    onReferenceGuideFilesChange,
    onMaterialOutputCountChange,
    onMaterialOutputSizeChange,
    onSavePromptTemplate,
    onGenerateMaterialImages,
  } = props;

  const materialsBadge = getBadge(dict, materialsStep, activeStepIndex === materialsStep.index);

  return (
    <>
      <article className="wf-panel reveal-up">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {localize(locale, "素材与上传", "Assets & Upload")}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {localize(locale, "可批量上传素材，勾选用于脚本与视频生成的参考图。", "Batch upload assets and select references for script/video generation.")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
              {selectedReferenceAssets.length}/{REFERENCE_ASSET_SELECTION_LIMIT}
            </span>
            <button
              type="button"
              onClick={onClearReferenceSelection}
              disabled={selectedReferenceAssetIds.length === 0}
              className="inline-flex h-8 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {localize(locale, "清空勾选", "Clear Selection")}
            </button>
          </div>
        </div>

        <form className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]" onSubmit={onUploadAsset}>
          <input
            key={assetInputKey}
            id="asset-file"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => onAssetFilesChange(Array.from(event.target.files ?? []))}
            className="block w-full cursor-pointer rounded-2xl border border-slate-300 bg-white p-2 text-xs text-slate-700 file:mr-2 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate-900 file:px-2 file:py-1.5 file:text-xs file:font-semibold file:text-white"
          />
          <button type="submit" disabled={assetState.loading} className={primaryButtonClass}>
            {assetState.loading ? dict.asset.submitting : dict.asset.submit}
          </button>
        </form>
        {assetState.result ? (
          <p className="wf-feedback mt-3" role={toMessageAriaRole(assetState.result)} aria-live="polite">
            {assetState.result}
          </p>
        ) : null}

        <div className="mt-4 max-h-[520px] overflow-auto pr-1">
          {materialLibrary.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-3 py-5 text-center text-sm text-slate-500">
              {localize(locale, "还没有素材，先上传几张图。", "No assets yet. Upload a few images first.")}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {[...materialLibrary]
                .sort((a, b) => Number(selectedReferenceAssetIds.includes(b.id)) - Number(selectedReferenceAssetIds.includes(a.id)))
                .map((asset) => {
                  const selected = selectedReferenceAssetIds.includes(asset.id);
                  const assetLabel = asset.fileName?.trim() || localize(locale, "未命名素材", "Untitled Asset");
                  return (
                    <article
                      key={`material-${asset.id}`}
                      className={`rounded-xl border p-2 transition ${
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
                            onChange={() => onToggleReferenceAsset(asset.id)}
                            className="h-4 w-4 accent-teal-700"
                          />
                          <span className="text-[11px] font-semibold text-slate-600">
                            {selected ? localize(locale, "已选中", "Selected") : localize(locale, "勾选", "Select")}
                          </span>
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenImagePreview(asset.url, assetLabel)}
                            className="text-[11px] font-semibold text-teal-700 underline underline-offset-4"
                          >
                            {localize(locale, "预览", "Preview")}
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDeleteAsset(asset.id)}
                            disabled={deletingAssetId === asset.id}
                            className="text-[11px] font-semibold text-rose-700 underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingAssetId === asset.id
                              ? localize(locale, "移除中...", "Removing...")
                              : localize(locale, "移除", "Remove")}
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenImagePreview(asset.url, assetLabel)}
                        className="mt-2 block w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={asset.url}
                          alt={assetLabel}
                          className="h-24 w-full object-contain"
                        />
                      </button>
                      <p className="mt-2 truncate text-xs font-semibold text-slate-700">{assetLabel}</p>
                    </article>
                  );
                })}
            </div>
          )}
        </div>
      </article>

      <article className="wf-panel reveal-up">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {localize(locale, "项目概览", "Project Overview")}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {localize(
                locale,
                "统计当前项目的素材、脚本、任务和成片数量。",
                "Quick stats for assets, scripts, jobs, and generated videos in this project.",
              )}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="wf-card">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{localize(locale, "素材", "Assets")}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{currentProjectSummary?.counts.assets ?? 0}</p>
          </div>
          <div className="wf-card">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{localize(locale, "脚本", "Scripts")}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{currentProjectSummary?.counts.scripts ?? 0}</p>
          </div>
          <div className="wf-card">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{localize(locale, "任务", "Jobs")}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{currentProjectSummary?.counts.renderJobs ?? 0}</p>
          </div>
          <div className="wf-card">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{localize(locale, "成片", "Videos")}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{currentProjectSummary?.counts.videos ?? 0}</p>
          </div>
        </div>
      </article>

      {activeStepId === "materials" ? (
        <article id="stage-materials" className="wf-panel reveal-up" style={{ animationDelay: "40ms" }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {dict.stepTag} {String((materialsStep.index ?? 0) + 1).padStart(2, "0")}
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">{dict.materialGen.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{dict.materialGen.desc}</p>
            </div>
            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${materialsBadge.cls}`}>
              {materialsBadge.text}
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="wf-card">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{dict.imageModelProvider}</p>
              {availableImageProviders.length > 0 ? (
                <select
                  value={resolvedImageProviderId}
                  onChange={(event) => onSelectImageProvider(event.target.value)}
                  className={`${inputClass} mt-2`}
                >
                  {availableImageProviders.map((provider) => (
                    <option key={`image-provider-${provider.id}`} value={provider.id}>
                      {provider.name} | {provider.selectedModelId || provider.manualModelId || dict.manualModel}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="mt-2 text-xs text-slate-600">
                  {localize(locale, "未发现可用图像模型，请先在", "No image model available. Enable one in ")}
                  <Link href="/settings" className="font-semibold text-teal-700 underline underline-offset-4">
                    {localize(locale, "设置页", "Settings")}
                  </Link>
                  {localize(locale, "配置 Seedream 模型。", ".")}
                </p>
              )}
            </div>

            <div className="wf-card">
              <label className="space-y-1">
                <span className="text-sm font-semibold text-slate-700">{dict.materialGen.chooseTemplate}</span>
                <select
                  value={selectedPromptTemplateId}
                  onChange={(event) => onSelectPromptTemplate(event.target.value)}
                  className={inputClass}
                >
                  <option value="">{localize(locale, "不使用模板", "No template")}</option>
                  {promptTemplates.map((template) => (
                    <option key={`prompt-template-${template.id}`} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-semibold text-slate-700">{dict.materialGen.templateName}</span>
              <input
                value={promptTemplateName}
                onChange={(event) => onPromptTemplateNameChange(event.target.value)}
                placeholder={dict.materialGen.templateNamePh}
                className={inputClass}
              />
            </label>
            <button
              type="button"
              onClick={() => void onSavePromptTemplate()}
              disabled={promptTemplateState.loading || !promptTemplateName.trim() || !materialPromptInput.trim()}
              className={`${secondaryButtonClass} self-end`}
            >
              {promptTemplateState.loading ? dict.materialGen.savingTemplate : dict.materialGen.saveTemplate}
            </button>
          </div>

          <label className="mt-4 block space-y-1">
            <span className="text-sm font-semibold text-slate-700">{dict.materialGen.prompt}</span>
            <textarea
              value={materialPromptInput}
              onChange={(event) => onMaterialPromptChange(event.target.value)}
              rows={3}
              placeholder={dict.materialGen.promptPh}
              className={textAreaClass}
            />
          </label>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-semibold text-slate-700">{dict.materialGen.prototypeFile}</span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => onPrototypeFileChange(event.target.files?.[0] ?? null)}
                className="block w-full cursor-pointer rounded-2xl border border-slate-300 bg-white p-2 text-xs text-slate-700 file:mr-2 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate-900 file:px-2 file:py-1.5 file:text-xs file:font-semibold file:text-white"
              />
              {prototypeAssetFile ? (
                <p className="text-[11px] text-slate-500">{prototypeAssetFile.name}</p>
              ) : null}
            </label>
            <label className="space-y-1">
              <span className="text-sm font-semibold text-slate-700">{dict.materialGen.refFiles}</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => onReferenceGuideFilesChange(Array.from(event.target.files ?? []))}
                className="block w-full cursor-pointer rounded-2xl border border-slate-300 bg-white p-2 text-xs text-slate-700 file:mr-2 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate-900 file:px-2 file:py-1.5 file:text-xs file:font-semibold file:text-white"
              />
              {referenceGuideFiles.length > 0 ? (
                <p className="text-[11px] text-slate-500">
                  {localize(locale, "已选择参考图", "Selected references")} {referenceGuideFiles.length}
                </p>
              ) : null}
            </label>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="space-y-1">
              <span className="text-sm font-semibold text-slate-700">{dict.materialGen.outputCount}</span>
              <input
                type="number"
                min={1}
                max={14}
                value={materialOutputCount}
                onChange={(event) => onMaterialOutputCountChange(Math.max(1, Math.min(14, Number(event.target.value) || 1)))}
                className={inputClass}
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-semibold text-slate-700">{dict.materialGen.size}</span>
              <input
                value={materialOutputSize}
                onChange={(event) => onMaterialOutputSizeChange(event.target.value)}
                placeholder={dict.materialGen.sizePh}
                className={inputClass}
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => void onGenerateMaterialImages()}
            disabled={Boolean(materialGenerateDisabledReason)}
            className={`${primaryButtonClass} mt-4 wf-mobile-sticky-btn`}
          >
            {materialGenState.loading ? dict.materialGen.submitting : dict.materialGen.submit}
          </button>
          {materialGenerateDisabledReason ? (
            <p className="mt-2 text-xs text-slate-500" role="status" aria-live="polite">
              {materialGenerateDisabledReason}{" "}
              {materialGenerateNeedsSettingsLink ? (
                <Link href="/settings" className="font-semibold text-teal-700 underline underline-offset-4">
                  {localize(locale, "前往模型配置", "Open model settings")}
                </Link>
              ) : null}
            </p>
          ) : null}

          {promptTemplateState.result ? (
            <p className="wf-feedback mt-3" role={toMessageAriaRole(promptTemplateState.result)} aria-live="polite">
              {promptTemplateState.result}
            </p>
          ) : null}
          {materialGenState.result ? (
            <p className="wf-feedback mt-3" role={toMessageAriaRole(materialGenState.result)} aria-live="polite">
              {materialGenState.result}
            </p>
          ) : null}
        </article>
      ) : null}
    </>
  );
}
