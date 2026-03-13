import Link from "next/link";
import type { FormEvent } from "react";

import type { StoredModelProvider } from "@/lib/models/model-settings.local";

import { LOCALES, localize } from "../workspace-copy";
import type {
  Dict,
  EditableShot,
  GenerationPayload,
  Locale,
  MaterialAssetItem,
  RequestState,
  StepId,
} from "../workspace-types";
import { toMessageAriaRole } from "../workspace-utils";

type ScriptPayload = {
  title: string;
  hook: string;
  sellingPoints: string;
  storyboard: string;
  cta: string;
};

type ScriptPanelProps = {
  locale: Locale;
  dict: Dict;
  activeStepId: StepId;
  scriptBadge: { text: string; cls: string };
  scriptStepIndex: number;
  generationPayload: GenerationPayload;
  contentLanguage: Locale;
  scriptPayload: ScriptPayload;
  scriptShots: EditableShot[];
  scriptId: string;
  selectedReferenceAssets: MaterialAssetItem[];
  scriptState: RequestState;
  scriptGenerateDisabledReason: string;
  scriptGenerateNeedsSettingsLink: boolean;
  availableTextProviders: StoredModelProvider[];
  resolvedTextProviderId: string;
  inputClass: string;
  textAreaClass: string;
  primaryButtonClass: string;
  secondaryButtonClass: string;
  onGenerateScript: (event: FormEvent<HTMLFormElement>) => void;
  onAutoFillScriptInputs: () => Promise<void>;
  onUpdateScript: () => Promise<void>;
  onSelectTextProvider: (providerId: string) => void;
  onProductNameChange: (value: string) => void;
  onTargetAudienceChange: (value: string) => void;
  onSellingPointsTextChange: (value: string) => void;
  onToneChange: (value: string) => void;
  onDurationChange: (value: number) => void;
  onContentLanguageChange: (value: Locale) => void;
  onScriptTitleChange: (value: string) => void;
  onScriptHookChange: (value: string) => void;
  onScriptSellingPointsChange: (value: string) => void;
  onScriptCtaChange: (value: string) => void;
  onScriptIdChange: (value: string) => void;
  onAddShot: () => void;
  onRemoveShot: (shotId: string) => void;
  onUpdateShotField: (shotId: string, field: keyof Omit<EditableShot, "id">, value: string | number) => void;
};

export function ScriptPanel(props: ScriptPanelProps) {
  const {
    locale,
    dict,
    activeStepId,
    scriptBadge,
    scriptStepIndex,
    generationPayload,
    contentLanguage,
    scriptPayload,
    scriptShots,
    scriptId,
    selectedReferenceAssets,
    scriptState,
    scriptGenerateDisabledReason,
    scriptGenerateNeedsSettingsLink,
    availableTextProviders,
    resolvedTextProviderId,
    inputClass,
    textAreaClass,
    primaryButtonClass,
    secondaryButtonClass,
    onGenerateScript,
    onAutoFillScriptInputs,
    onUpdateScript,
    onSelectTextProvider,
    onProductNameChange,
    onTargetAudienceChange,
    onSellingPointsTextChange,
    onToneChange,
    onDurationChange,
    onContentLanguageChange,
    onScriptTitleChange,
    onScriptHookChange,
    onScriptSellingPointsChange,
    onScriptCtaChange,
    onScriptIdChange,
    onAddShot,
    onRemoveShot,
    onUpdateShotField,
  } = props;

  if (activeStepId !== "script") {
    return null;
  }

  return (
    <article id="stage-script" className="wf-panel reveal-up" style={{ animationDelay: "60ms" }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {dict.stepTag} {String(scriptStepIndex + 1).padStart(2, "0")}
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">{dict.script.title}</h2>
          <p className="mt-2 text-sm text-slate-600">{dict.script.desc}</p>
        </div>
        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${scriptBadge.cls}`}>
          {scriptBadge.text}
        </span>
      </div>

      <form className="mt-5 space-y-3" onSubmit={onGenerateScript}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-700">{dict.script.product}</span>
            <input
              value={generationPayload.productName}
              onChange={(event) => onProductNameChange(event.target.value)}
              placeholder={dict.script.productPh}
              className={inputClass}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-700">{dict.script.audience}</span>
            <input
              value={generationPayload.targetAudience}
              onChange={(event) => onTargetAudienceChange(event.target.value)}
              placeholder={dict.script.audiencePh}
              className={inputClass}
            />
          </label>
        </div>

        <label className="space-y-1">
          <span className="text-sm font-semibold text-slate-700">{dict.script.points}</span>
          <textarea
            value={generationPayload.sellingPointsText}
            onChange={(event) => onSellingPointsTextChange(event.target.value)}
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
              onChange={(event) => onToneChange(event.target.value)}
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
              onChange={(event) => onDurationChange(Number(event.target.value))}
              className={inputClass}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-700">{dict.script.outLang}</span>
            <select value={contentLanguage} onChange={(event) => onContentLanguageChange(event.target.value as Locale)} className={inputClass}>
              {LOCALES.map((option) => (
                <option key={`out-${option}`} value={option}>
                  {dict.languages[option]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="wf-card">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{dict.textModelProvider}</p>
          {availableTextProviders.length > 0 ? (
            <select
              value={resolvedTextProviderId}
              onChange={(event) => onSelectTextProvider(event.target.value)}
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

        <div className="wf-card">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
            {localize(locale, "素材参考上下文", "Material Context")}
          </p>
          {selectedReferenceAssets.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedReferenceAssets.map((asset) => (
                <span key={`selected-ref-${asset.id}`} className="inline-flex rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
                  {asset.fileName?.trim() || localize(locale, "未命名素材", "Untitled Asset")}
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
          onClick={() => void onAutoFillScriptInputs()}
          disabled={scriptState.loading || selectedReferenceAssets.length === 0}
          className={secondaryButtonClass}
        >
          {localize(locale, "根据素材自动填充参数", "Auto-fill fields from assets")}
        </button>

        <button type="submit" disabled={Boolean(scriptGenerateDisabledReason)} className={`${primaryButtonClass} wf-mobile-sticky-btn`}>
          {scriptState.loading ? dict.script.submitting : dict.script.submit}
        </button>
        {scriptGenerateDisabledReason ? (
          <p className="mt-1 text-xs text-slate-500" role="status" aria-live="polite">
            {scriptGenerateDisabledReason}{" "}
            {scriptGenerateNeedsSettingsLink ? (
              <Link href="/settings" className="font-semibold text-teal-700 underline underline-offset-4">
                {localize(locale, "前往模型配置", "Open model settings")}
              </Link>
            ) : null}
          </p>
        ) : null}
      </form>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{dict.script.editTitle}</p>
        <div className="mt-3 space-y-3">
          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-700">{dict.script.fieldTitle}</span>
            <input
              value={scriptPayload.title}
              onChange={(event) => onScriptTitleChange(event.target.value)}
              className={inputClass}
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-700">{dict.script.hook}</span>
            <textarea
              value={scriptPayload.hook}
              onChange={(event) => onScriptHookChange(event.target.value)}
              rows={2}
              className={textAreaClass}
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-700">{dict.script.sellPoints}</span>
            <textarea
              value={scriptPayload.sellingPoints}
              onChange={(event) => onScriptSellingPointsChange(event.target.value)}
              rows={2}
              className={textAreaClass}
            />
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-700">{dict.script.storyboard}</span>
              <button
                type="button"
                onClick={onAddShot}
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
                      onClick={() => onRemoveShot(shot.id)}
                      disabled={scriptShots.length <= 1}
                      className="text-[11px] font-semibold text-slate-500 underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {localize(locale, "删除", "Remove")}
                    </button>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <input
                      value={shot.visual}
                      onChange={(event) => onUpdateShotField(shot.id, "visual", event.target.value)}
                      placeholder={localize(locale, "画面描述", "Visual description")}
                      className={inputClass}
                    />
                    <input
                      value={shot.camera}
                      onChange={(event) => onUpdateShotField(shot.id, "camera", event.target.value)}
                      placeholder={localize(locale, "镜头语言", "Camera movement")}
                      className={inputClass}
                    />
                    <input
                      value={shot.caption}
                      onChange={(event) => onUpdateShotField(shot.id, "caption", event.target.value)}
                      placeholder={localize(locale, "字幕文案", "Caption text")}
                      className={inputClass}
                    />
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={shot.durationSec}
                      onChange={(event) => onUpdateShotField(shot.id, "durationSec", Number(event.target.value))}
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
              onChange={(event) => onScriptCtaChange(event.target.value)}
              className={inputClass}
            />
          </label>

          <button
            type="button"
            onClick={() => void onUpdateScript()}
            disabled={scriptState.loading || !scriptId.trim()}
            className={secondaryButtonClass}
          >
            {scriptState.loading ? dict.script.saving : dict.script.save}
          </button>
        </div>
      </div>

      <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">
          {localize(locale, "高级：绑定已有脚本（可选）", "Advanced: Bind Existing Script (Optional)")}
        </summary>
        <div className="mt-3">
          <label htmlFor="script-id" className="text-sm font-semibold text-slate-700">
            {dict.script.scriptId}
          </label>
          <input
            id="script-id"
            value={scriptId}
            onChange={(event) => onScriptIdChange(event.target.value)}
            placeholder={dict.script.scriptIdPh}
            className={`${inputClass} mt-1`}
          />
          <p className="mt-1 text-xs text-slate-500">
            {localize(
              locale,
              "仅在恢复旧脚本时需要填写，常规流程可忽略。",
              "Only needed when restoring an existing script. You can ignore this in normal flow.",
            )}
          </p>
        </div>
      </details>

      {scriptState.result ? (
        <p className="wf-feedback mt-3" role={toMessageAriaRole(scriptState.result)} aria-live="polite">
          {scriptState.result}
        </p>
      ) : null}
    </article>
  );
}
