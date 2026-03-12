"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  WORKFLOW_DEFAULT_PROJECT_ID,
  buildProjectDetailPath,
} from "@/lib/projects/project-navigation";

type Locale = "zh-CN" | "en-US";

type ProjectSummaryItem = {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string;
  counts: {
    assets: number;
    scripts: number;
    renderJobs: number;
    videos: number;
  };
};

type Dict = {
  heroTag: string;
  heroTitle: string;
  heroDesc: string;
  refresh: string;
  refreshing: string;
  createLabel: string;
  createPlaceholder: string;
  createButton: string;
  cardsTitle: string;
  cardsHint: string;
  empty: string;
  open: string;
  updated: string;
  assets: string;
  scripts: string;
  jobs: string;
  videos: string;
  modelSettings: string;
  errorPrefix: string;
  localeLabel: string;
  languages: Record<Locale, string>;
};

const LOCALE_KEY = "video-workflow-locale";
const LOCALES: Locale[] = ["zh-CN", "en-US"];

const TEXT: Record<Locale, Dict> = {
  "zh-CN": {
    heroTag: "项目工作台入口",
    heroTitle: "项目卡片总览",
    heroDesc: "先选择项目卡片，再进入项目详情页进行配置与生成。",
    refresh: "刷新项目",
    refreshing: "刷新中...",
    createLabel: "新建项目标题",
    createPlaceholder: "例如：龙年新品发布",
    createButton: "创建并进入",
    cardsTitle: "项目列表",
    cardsHint: "点击任意卡片进入详细配置与生成工作台。",
    empty: "暂无项目，先创建一个开始。",
    open: "进入项目",
    updated: "更新时间",
    assets: "素材",
    scripts: "脚本",
    jobs: "任务",
    videos: "成片",
    modelSettings: "模型配置",
    errorPrefix: "请求失败",
    localeLabel: "界面语言",
    languages: {
      "zh-CN": "中文",
      "en-US": "English",
    },
  },
  "en-US": {
    heroTag: "Project Workspace Entry",
    heroTitle: "Project Card Overview",
    heroDesc: "Select a project card first, then open the detail workspace for configuration and generation.",
    refresh: "Refresh Projects",
    refreshing: "Refreshing...",
    createLabel: "New Project Title",
    createPlaceholder: "e.g. Dragon Product Launch",
    createButton: "Create & Open",
    cardsTitle: "Projects",
    cardsHint: "Click a card to open the detailed config and generation workspace.",
    empty: "No projects yet. Create one to get started.",
    open: "Open Project",
    updated: "Updated",
    assets: "Assets",
    scripts: "Scripts",
    jobs: "Jobs",
    videos: "Videos",
    modelSettings: "Model Settings",
    errorPrefix: "Request failed",
    localeLabel: "Interface Language",
    languages: {
      "zh-CN": "中文",
      "en-US": "English",
    },
  },
};

function toJsonRecord(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {};
  }
  return data as Record<string, unknown>;
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export default function Home() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("zh-CN");
  const [projects, setProjects] = useState<ProjectSummaryItem[]>([]);
  const [draftProjectTitle, setDraftProjectTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");

  const dict = TEXT[locale];

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const saved = window.localStorage.getItem(LOCALE_KEY);
    if (saved === "zh-CN" || saved === "en-US") {
      setLocale(saved);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_KEY, locale);
    }
  }, [locale]);

  const refreshProjects = useCallback(async () => {
    setLoading(true);
    setMessage(locale === "zh-CN" ? "正在拉取项目列表..." : "Loading projects...");

    try {
      const response = await fetch("/api/projects?limit=80");
      const data = toJsonRecord(await readJsonResponse(response));
      const items = Array.isArray(data.items) ? (data.items as ProjectSummaryItem[]) : [];
      setProjects(items);

      if (!response.ok) {
        setMessage(`${dict.errorPrefix} ${response.status}`);
        return;
      }

      setMessage(
        locale === "zh-CN"
          ? `已加载 ${items.length} 个项目。`
          : `Loaded ${items.length} project${items.length === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `${locale === "zh-CN" ? "加载失败" : "Failed to load"}: ${error.message}`
          : locale === "zh-CN"
            ? "加载失败"
            : "Failed to load",
      );
    } finally {
      setLoading(false);
    }
  }, [dict.errorPrefix, locale]);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [projects],
  );

  async function handleCreateProject() {
    const normalizedProjectTitle = draftProjectTitle.trim();
    if (!normalizedProjectTitle) {
      setMessage(locale === "zh-CN" ? "请输入项目标题。" : "Please enter a project title.");
      return;
    }

    setCreating(true);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: normalizedProjectTitle,
        }),
      });

      const data = toJsonRecord(await readJsonResponse(response));
      if (!response.ok) {
        setMessage(`${dict.errorPrefix} ${response.status}\n${JSON.stringify(data, null, 2)}`);
        return;
      }

      const createdProjectId = typeof data.id === "string" ? data.id : "";
      if (!createdProjectId) {
        setMessage(
          locale === "zh-CN"
            ? "项目创建成功，但未获取到项目 ID。"
            : "Project created, but no project ID was returned.",
        );
        return;
      }

      router.push(buildProjectDetailPath(createdProjectId));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `${locale === "zh-CN" ? "创建失败" : "Failed to create"}: ${error.message}`
          : locale === "zh-CN"
            ? "创建失败"
            : "Failed to create",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen pb-20">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-6 md:px-8 lg:pt-8">
        <section className="relative overflow-hidden rounded-[30px] border border-white/70 bg-white/85 p-6 shadow-[0_22px_60px_rgba(15,23,42,0.1)] backdrop-blur md:p-8">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(15,118,110,0.22),rgba(15,118,110,0))]" />
          <div className="pointer-events-none absolute -left-14 bottom-0 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(234,88,12,0.18),rgba(234,88,12,0))]" />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{dict.heroTag}</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900 md:text-5xl">{dict.heroTitle}</h1>
              <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">{dict.heroDesc}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{dict.localeLabel}</p>
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                {LOCALES.map((option) => {
                  const active = locale === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setLocale(option)}
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
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <label className="space-y-1">
              <span className="text-sm font-semibold text-slate-700">{dict.createLabel}</span>
              <input
                value={draftProjectTitle}
                onChange={(event) => setDraftProjectTitle(event.target.value)}
                placeholder={dict.createPlaceholder}
                className="h-11 w-full rounded-2xl border border-slate-300/90 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-200"
              />
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void refreshProjects()}
                disabled={loading}
                className="inline-flex h-11 cursor-pointer items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {loading ? dict.refreshing : dict.refresh}
              </button>
              <button
                type="button"
                onClick={() => void handleCreateProject()}
                disabled={creating || !draftProjectTitle.trim()}
                className="inline-flex h-11 cursor-pointer items-center justify-center rounded-2xl bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {creating ? "..." : dict.createButton}
              </button>
            </div>
          </div>

          <p className="mt-2 text-xs text-slate-500">{message}</p>
        </section>

        <section className="rounded-3xl border border-white/70 bg-white/84 p-6 shadow-[0_16px_45px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{dict.cardsTitle}</p>
              <p className="mt-1 text-sm text-slate-600">{dict.cardsHint}</p>
            </div>
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-slate-700">
              {sortedProjects.length} Projects
            </span>
          </div>

          {sortedProjects.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-600">
              {dict.empty}
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {sortedProjects.map((project) => (
                <article
                  key={project.id}
                  className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{project.name || project.id}</p>
                      <p className="mt-1 text-xs text-slate-500">{project.id}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                      {dict.updated}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-500">{new Date(project.updatedAt).toLocaleString(locale)}</p>

                  <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                    <div className="rounded-xl bg-slate-100 px-2 py-2">
                      <p className="text-[11px] text-slate-500">{dict.assets}</p>
                      <p className="text-sm font-semibold text-slate-900">{project.counts.assets}</p>
                    </div>
                    <div className="rounded-xl bg-slate-100 px-2 py-2">
                      <p className="text-[11px] text-slate-500">{dict.scripts}</p>
                      <p className="text-sm font-semibold text-slate-900">{project.counts.scripts}</p>
                    </div>
                    <div className="rounded-xl bg-slate-100 px-2 py-2">
                      <p className="text-[11px] text-slate-500">{dict.jobs}</p>
                      <p className="text-sm font-semibold text-slate-900">{project.counts.renderJobs}</p>
                    </div>
                    <div className="rounded-xl bg-slate-100 px-2 py-2">
                      <p className="text-[11px] text-slate-500">{dict.videos}</p>
                      <p className="text-sm font-semibold text-slate-900">{project.counts.videos}</p>
                    </div>
                  </div>

                  <Link
                    href={buildProjectDetailPath(project.id)}
                    className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-teal-700"
                  >
                    {dict.open}
                  </Link>
                </article>
              ))}
            </div>
          )}

          <div className="mt-4">
            <Link
              href={buildProjectDetailPath(WORKFLOW_DEFAULT_PROJECT_ID)}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              {locale === "zh-CN" ? "进入默认项目" : "Open Default Project"}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
