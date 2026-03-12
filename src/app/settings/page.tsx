"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  createDefaultStoredModelProvider,
  loadStoredModelProvidersFromLocalStorage,
  saveStoredModelProvidersToLocalStorage,
  type StoredModelProvider,
} from "../../lib/models/model-settings.local";
import {
  getDefaultBaseUrlByProtocol,
  getProtocolsForCapability,
  type ModelCapability,
  type ModelProtocol,
} from "../../lib/models/model-provider.types";

type ListedModel = {
  id: string;
  label: string;
};

function createProviderId(): string {
  return `mdl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function capabilityLabel(capability: ModelCapability): string {
  if (capability === "text") {
    return "文本模型";
  }
  if (capability === "image") {
    return "图像模型";
  }
  return "视频模型";
}

function protocolLabel(protocol: ModelProtocol): string {
  if (protocol === "openai") {
    return "OpenAI 协议";
  }
  if (protocol === "gemini") {
    return "Gemini 协议";
  }
  if (protocol === "seedance") {
    return "字节 Seedance 协议";
  }
  return "Google 协议";
}

export default function ModelSettingsPage() {
  const [providers, setProviders] = useState<StoredModelProvider[]>(() =>
    loadStoredModelProvidersFromLocalStorage(),
  );
  const [modelsByProvider, setModelsByProvider] = useState<Record<string, ListedModel[]>>({});
  const [loadingByProvider, setLoadingByProvider] = useState<Record<string, boolean>>({});
  const [messageByProvider, setMessageByProvider] = useState<Record<string, string>>({});

  const enabledCount = useMemo(() => providers.filter((item) => item.enabled).length, [providers]);
  const textEnabledCount = useMemo(
    () => providers.filter((item) => item.enabled && item.capability === "text").length,
    [providers],
  );
  const imageEnabledCount = useMemo(
    () => providers.filter((item) => item.enabled && item.capability === "image").length,
    [providers],
  );
  const videoEnabledCount = useMemo(
    () => providers.filter((item) => item.enabled && item.capability === "video").length,
    [providers],
  );

  function persist(nextProviders: StoredModelProvider[]) {
    setProviders(nextProviders);
    saveStoredModelProvidersToLocalStorage(nextProviders);
  }

  function updateProvider(providerId: string, updater: (item: StoredModelProvider) => StoredModelProvider) {
    const next = providers.map((item) => (item.id === providerId ? updater(item) : item));
    persist(next);
  }

  function addProvider() {
    const provider = createDefaultStoredModelProvider({
      id: createProviderId(),
      capability: "text",
      protocol: "openai",
    });
    persist([provider, ...providers]);
  }

  function removeProvider(providerId: string) {
    const next = providers.filter((item) => item.id !== providerId);
    persist(next);

    setModelsByProvider((prev) => {
      const rest = { ...prev };
      delete rest[providerId];
      return rest;
    });
    setLoadingByProvider((prev) => {
      const rest = { ...prev };
      delete rest[providerId];
      return rest;
    });
    setMessageByProvider((prev) => {
      const rest = { ...prev };
      delete rest[providerId];
      return rest;
    });
  }

  async function fetchModels(provider: StoredModelProvider) {
    setLoadingByProvider((prev) => ({ ...prev, [provider.id]: true }));
    setMessageByProvider((prev) => ({ ...prev, [provider.id]: "正在拉取模型列表..." }));

    try {
      const response = await fetch("/model/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          protocol: provider.protocol,
          baseURL: provider.baseURL,
          apiKey: provider.apiKey,
        }),
      });

      const text = await response.text();
      const parsed = text ? (JSON.parse(text) as { models?: ListedModel[]; message?: string }) : {};

      if (!response.ok || !Array.isArray(parsed.models)) {
        throw new Error(parsed.message ?? `HTTP ${response.status}`);
      }
      const models = parsed.models;

      setModelsByProvider((prev) => ({ ...prev, [provider.id]: models }));
      setMessageByProvider((prev) => ({
        ...prev,
        [provider.id]:
          models.length > 0
            ? `已获取 ${models.length} 个模型。`
            : "未拉取到可用模型，请手动填写 model_id。",
      }));

      if (!provider.selectedModelId && models[0]?.id) {
        updateProvider(provider.id, (item) => ({
          ...item,
          selectedModelId: models[0]?.id ?? "",
        }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "模型列表拉取失败，请手动填写 model_id。";
      setMessageByProvider((prev) => ({
        ...prev,
        [provider.id]: `${message}（你仍可手动填写 model_id）`,
      }));
    } finally {
      setLoadingByProvider((prev) => ({ ...prev, [provider.id]: false }));
    }
  }

  return (
    <div className="min-h-screen pb-20">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-6 md:px-8 lg:pt-8">
        <section className="relative overflow-hidden rounded-[30px] border border-white/70 bg-white/85 p-6 shadow-[0_22px_60px_rgba(15,23,42,0.1)] backdrop-blur md:p-8">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(15,118,110,0.22),rgba(15,118,110,0))]" />
          <div className="pointer-events-none absolute -left-14 bottom-0 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(234,88,12,0.18),rgba(234,88,12,0))]" />

          <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">模型供应商设置</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900 md:text-5xl">模型供应商配置中心</h1>
              <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
                支持为文本、图像、视频分别配置多个供应商。默认通过 <code>/model/list</code> 拉取模型；失败时可手动填写
                <code> model_id</code>。API Key 仅存储在浏览器本地（localStorage）。
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                返回工作台
              </Link>
              <button
                type="button"
                onClick={addProvider}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                新增供应商
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-slate-500">已启用总数</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{enabledCount}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-slate-500">文本</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{textEnabledCount}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-slate-500">图像</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{imageEnabledCount}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-slate-500">视频</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{videoEnabledCount}</p>
            </article>
          </div>
        </section>

        <section className="space-y-4">
          {providers.length === 0 ? (
            <article className="rounded-3xl border border-white/70 bg-white/84 p-6 shadow-[0_16px_45px_rgba(15,23,42,0.08)]">
              <p className="text-sm text-slate-600">还没有供应商配置。点击上方“新增供应商”开始。</p>
            </article>
          ) : null}

          {providers.map((provider) => {
            const supportedProtocols = getProtocolsForCapability(provider.capability);
            const fetchedModels = modelsByProvider[provider.id] ?? [];
            const isLoading = loadingByProvider[provider.id] ?? false;
            const message = messageByProvider[provider.id];
            const inputClass =
              "h-11 w-full rounded-2xl border border-slate-300/90 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-200";

            return (
              <article
                key={provider.id}
                className="reveal-up rounded-3xl border border-white/70 bg-white/84 p-6 shadow-[0_16px_45px_rgba(15,23,42,0.08)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {capabilityLabel(provider.capability)}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-900">{provider.name}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeProvider(provider.id)}
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                  >
                    删除
                  </button>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-sm font-semibold text-slate-700">名称</span>
                    <input
                      value={provider.name}
                      onChange={(event) =>
                        updateProvider(provider.id, (item) => ({
                          ...item,
                          name: event.target.value,
                        }))
                      }
                      className={inputClass}
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-sm font-semibold text-slate-700">能力类型</span>
                    <select
                      value={provider.capability}
                      onChange={(event) => {
                        const nextCapability = event.target.value as ModelCapability;
                        const nextProtocols = getProtocolsForCapability(nextCapability);
                        const nextProtocol = nextProtocols[0] ?? provider.protocol;

                        updateProvider(provider.id, (item) => ({
                          ...item,
                          capability: nextCapability,
                          protocol: nextProtocol,
                          baseURL: getDefaultBaseUrlByProtocol(nextProtocol),
                          selectedModelId: "",
                          manualModelId: "",
                        }));
                      }}
                      className={inputClass}
                    >
                      <option value="text">文本</option>
                      <option value="image">图像</option>
                      <option value="video">视频</option>
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-sm font-semibold text-slate-700">协议</span>
                    <select
                      value={provider.protocol}
                      onChange={(event) => {
                        const nextProtocol = event.target.value as ModelProtocol;
                        updateProvider(provider.id, (item) => ({
                          ...item,
                          protocol: nextProtocol,
                          baseURL: getDefaultBaseUrlByProtocol(nextProtocol),
                          selectedModelId: "",
                        }));
                      }}
                      className={inputClass}
                    >
                      {supportedProtocols.map((protocol) => (
                        <option key={`${provider.id}-${protocol}`} value={protocol}>
                          {protocolLabel(protocol)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-sm font-semibold text-slate-700">Base URL</span>
                    <input
                      value={provider.baseURL}
                      onChange={(event) =>
                        updateProvider(provider.id, (item) => ({
                          ...item,
                          baseURL: event.target.value,
                        }))
                      }
                      className={inputClass}
                    />
                  </label>

                  <label className="space-y-1 lg:col-span-2">
                    <span className="text-sm font-semibold text-slate-700">API Key（仅本地保存）</span>
                    <input
                      type="password"
                      value={provider.apiKey}
                      onChange={(event) =>
                        updateProvider(provider.id, (item) => ({
                          ...item,
                          apiKey: event.target.value,
                        }))
                      }
                      className={inputClass}
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fetchModels(provider)}
                    disabled={isLoading || !provider.apiKey.trim() || !provider.baseURL.trim()}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {isLoading ? "拉取中..." : "通过 /model/list 拉取模型"}
                  </button>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={provider.enabled}
                      onChange={(event) =>
                        updateProvider(provider.id, (item) => ({
                          ...item,
                          enabled: event.target.checked,
                        }))
                      }
                    />
                    启用该供应商
                  </label>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-sm font-semibold text-slate-700">已拉取模型</span>
                    <select
                      value={provider.selectedModelId}
                      onChange={(event) =>
                        updateProvider(provider.id, (item) => ({
                          ...item,
                          selectedModelId: event.target.value,
                        }))
                      }
                      className={inputClass}
                    >
                      <option value="">未选择</option>
                      {fetchedModels.map((model) => (
                        <option key={`${provider.id}-${model.id}`} value={model.id}>
                          {model.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-sm font-semibold text-slate-700">手动 model_id（拉取失败兜底）</span>
                    <input
                      value={provider.manualModelId}
                      onChange={(event) =>
                        updateProvider(provider.id, (item) => ({
                          ...item,
                          manualModelId: event.target.value,
                        }))
                      }
                      placeholder="例如：gpt-4.1-mini / models/gemini-2.5-flash / seadance-v1"
                      className={inputClass}
                    />
                  </label>
                </div>

                {message ? <p className="mt-3 text-xs text-slate-600">{message}</p> : null}
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
