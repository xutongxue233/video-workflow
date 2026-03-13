import { localize } from "../workspace-copy";
import type { Dict, Locale, RenderHistoryItem, ScriptJobGroup } from "../workspace-types";
import { toRenderStatusChipClass, toRenderStatusLabel } from "../workspace-utils";

type TimelinePanelProps = {
  locale: Locale;
  dict: Dict;
  scriptJobGroups: ScriptJobGroup[];
  onLoadScript: (scriptId: string) => void;
  onSelectRenderJob: (job: RenderHistoryItem) => void;
};

export function TimelinePanel(props: TimelinePanelProps) {
  const { locale, dict, scriptJobGroups, onLoadScript, onSelectRenderJob } = props;

  return (
    <article className="wf-panel reveal-up" style={{ animationDelay: "220ms" }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {localize(locale, "创作记录", "Creation Timeline")}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {localize(
              locale,
              "按时间查看历史脚本与视频任务，点击即可回到对应工作步骤。",
              "Review script and render history in time order, and jump back to the related step.",
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 max-h-[420px] space-y-3 overflow-auto pr-1">
        {scriptJobGroups.length > 0 ? (
          scriptJobGroups.map((group, groupIndex) => (
            <article key={`timeline-${group.key}`} className="wf-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {group.script?.title?.trim() || localize(locale, `脚本草稿 ${groupIndex + 1}`, `Script Draft ${groupIndex + 1}`)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {group.script
                      ? `${new Date(group.script.updatedAt).toLocaleString(locale)} · ${group.script.generatorModel || dict.modelUnknown}`
                      : localize(locale, "该记录仅包含视频任务。", "This record contains render jobs only.")}
                  </p>
                </div>
                {group.script ? (
                  <button
                    type="button"
                    onClick={() => onLoadScript(group.script?.id || "")}
                    className="shrink-0 text-[11px] font-semibold text-teal-700 underline underline-offset-4"
                  >
                    {localize(locale, "载入脚本", "Load Script")}
                  </button>
                ) : null}
              </div>

              {group.jobs.length > 0 ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {group.jobs.slice(0, 6).map((job, jobIndex) => (
                    <button
                      key={`timeline-job-${job.id}`}
                      type="button"
                      onClick={() => onSelectRenderJob(job)}
                      className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-teal-300 hover:bg-teal-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-slate-800">
                          {localize(locale, "视频任务", "Render Task")} {jobIndex + 1}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                          {new Date(job.updatedAt).toLocaleString(locale)}
                        </span>
                      </span>
                      <span className={`ml-2 inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${toRenderStatusChipClass(job.status)}`}>
                        {toRenderStatusLabel(locale, job.status)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">{localize(locale, "该脚本还没有任务。", "No render jobs for this script yet.")}</p>
              )}
            </article>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-3 py-5 text-center text-sm text-slate-500">
            {localize(locale, "暂无脚本与任务历史。", "No script or render history yet.")}
          </p>
        )}
      </div>
    </article>
  );
}
