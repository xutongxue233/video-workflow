import { LOCALES } from "../workspace-copy";
import type { Dict, Locale, StepId, StepView } from "../workspace-types";
import { getBadge } from "../workspace-utils";

type WorkflowSidebarProps = {
  locale: Locale;
  dict: Dict;
  steps: StepView[];
  activeStepIndex: number;
  progress: number;
  onSelectStep: (stepId: StepId) => void;
  onSwitchLocale: (next: Locale) => void;
};

export function WorkflowSidebar(props: WorkflowSidebarProps) {
  const { locale, dict, steps, activeStepIndex, progress, onSelectStep, onSwitchLocale } = props;

  return (
    <aside className="space-y-4 lg:sticky lg:top-6 lg:h-fit">
      <section className="wf-panel p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{dict.progressTitle}</p>
        <p className="mt-1 text-sm text-slate-600">{dict.progressHint}</p>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-[linear-gradient(90deg,#0f766e,#14b8a6)] transition-[width]" style={{ width: `${progress}%` }} />
        </div>

        <div className="mt-4 space-y-2">
          {steps.map((step, index) => {
            const badge = getBadge(dict, step, index === activeStepIndex);
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => onSelectStep(step.id)}
                className="flex w-full cursor-pointer items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-teal-300 hover:bg-teal-50/40"
                aria-current={index === activeStepIndex ? "step" : undefined}
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                    {dict.stepTag} {String(index + 1).padStart(2, "0")}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{step.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{step.hint}</p>
                  {step.criteria ? (
                    <p className="mt-1 text-[11px] text-slate-400">{step.criteria}</p>
                  ) : null}
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
                  onClick={() => onSwitchLocale(option)}
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
  );
}
