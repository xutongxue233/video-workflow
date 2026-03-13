import Link from "next/link";

import { LOCALES, localize } from "../workspace-copy";
import type { Dict, Locale } from "../workspace-types";
import { toMessageAriaRole } from "../workspace-utils";

type WorkspaceHeaderProps = {
  locale: Locale;
  dict: Dict;
  contentLanguage: Locale;
  projectId: string;
  currentProjectName: string | null;
  completed: number;
  stepCount: number;
  progress: number;
  workspaceMessage: string;
  onSwitchLocale: (next: Locale) => void;
};

export function WorkspaceHeader(props: WorkspaceHeaderProps) {
  const {
    locale,
    dict,
    contentLanguage,
    projectId,
    currentProjectName,
    completed,
    stepCount,
    progress,
    workspaceMessage,
    onSwitchLocale,
  } = props;

  return (
    <section className="wf-hero">
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(15,118,110,0.22),rgba(15,118,110,0))]" />
      <div className="pointer-events-none absolute -left-14 bottom-0 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(234,88,12,0.18),rgba(234,88,12,0))]" />

      <div className="relative flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <p className="wf-eyebrow">{dict.heroTag}</p>
          <h1 className="wf-hero-title">{dict.heroTitle}</h1>
          <p className="wf-hero-desc">{dict.heroDesc}</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700">
            <span>{localize(locale, "当前项目", "Current Project")}</span>
            <span className="text-slate-800">
              {currentProjectName || projectId}
            </span>
          </div>
          {workspaceMessage ? (
            <p className="mt-2 text-xs text-slate-500" role={toMessageAriaRole(workspaceMessage)} aria-live="polite">
              {workspaceMessage}
            </p>
          ) : null}
        </div>

        <div className="wf-card max-w-[240px]">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{dict.localeLabel}</p>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {LOCALES.map((option) => {
              const active = locale === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onSwitchLocale(option)}
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
            {dict.modelSettings}
          </Link>
          <Link
            href="/"
            className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            {dict.backToHome}
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <article className="wf-card">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-500">{dict.completion}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {completed}/{stepCount}
          </p>
          <p className="text-xs text-slate-500">{progress}%</p>
        </article>
        <article className="wf-card">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-500">{dict.uiLang}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{dict.languages[locale]}</p>
        </article>
        <article className="wf-card">
          <p className="text-xs uppercase tracking-[0.15em] text-slate-500">{dict.contentLang}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{dict.languages[contentLanguage]}</p>
        </article>
      </div>
    </section>
  );
}
