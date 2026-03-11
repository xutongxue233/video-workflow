"use client";

import { useMemo, useState, type FormEvent } from "react";

type RequestState = {
  loading: boolean;
  result: string;
};

type JsonRecord = Record<string, unknown>;

type GeneratedShot = {
  index: number;
  durationSec: number;
  visual: string;
  caption: string;
  camera: string;
};

type GeneratedStructuredJson = {
  title: string;
  hook: string;
  voiceover: string;
  cta: string;
  shots: GeneratedShot[];
};

function formatJson(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }

  return JSON.stringify(data, null, 2);
}

function toJsonRecord(data: unknown): JsonRecord {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {};
  }

  return data as JsonRecord;
}

function isGeneratedStructuredJson(data: unknown): data is GeneratedStructuredJson {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return false;
  }

  const record = data as JsonRecord;

  return (
    typeof record.title === "string" &&
    typeof record.hook === "string" &&
    typeof record.voiceover === "string" &&
    typeof record.cta === "string" &&
    Array.isArray(record.shots)
  );
}

function toStoryboardText(shots: GeneratedShot[]): string {
  return shots
    .map((shot) => `${shot.index}. ${shot.visual} | ${shot.caption} | ${shot.camera}`)
    .join("\n");
}

function parseSellingPoints(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
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
  const [projectId, setProjectId] = useState("proj_demo");

  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [assetUrl, setAssetUrl] = useState<string>("");
  const [assetState, setAssetState] = useState<RequestState>({
    loading: false,
    result: "",
  });

  const [scriptId, setScriptId] = useState("");
  const [generationPayload, setGenerationPayload] = useState({
    productName: "Miniature Dragon",
    sellingPointsText: "high detail, easy support removal",
    targetAudience: "tabletop gamers",
    tone: "energetic",
    durationSec: 30,
  });
  const [scriptPayload, setScriptPayload] = useState({
    title: "",
    hook: "",
    sellingPoints: "",
    storyboard: "",
    cta: "",
  });
  const [scriptState, setScriptState] = useState<RequestState>({
    loading: false,
    result: "",
  });

  const [ttsText, setTtsText] = useState(
    "Meet the fastest way to showcase your 3D print model.",
  );
  const [voiceStyle, setVoiceStyle] = useState("energetic");
  const [ttsUrl, setTtsUrl] = useState("");
  const [ttsState, setTtsState] = useState<RequestState>({
    loading: false,
    result: "",
  });

  const [renderState, setRenderState] = useState<RequestState>({
    loading: false,
    result: "",
  });

  const [renderAspectRatio, setRenderAspectRatio] = useState<"9:16" | "16:9">("9:16");

  const canCreateRenderJob = useMemo(() => Boolean(scriptId.trim()), [scriptId]);

  async function handleUploadAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!assetFile) {
      setAssetState({ loading: false, result: "Please choose a file first." });
      return;
    }

    setAssetState({ loading: true, result: "Uploading..." });

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("file", assetFile);

    const response = await fetch("/api/assets", {
      method: "POST",
      body: formData,
    });

    const data = toJsonRecord(await readJsonResponse(response));

    if (response.ok) {
      const url = typeof data.url === "string" ? data.url : "";
      setAssetUrl(url);
      setAssetState({ loading: false, result: formatJson(data) });
      return;
    }

    setAssetState({ loading: false, result: `Error ${response.status}\n${formatJson(data)}` });
  }

  async function handleGenerateScript(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const sellingPoints = parseSellingPoints(generationPayload.sellingPointsText);

    if (sellingPoints.length === 0) {
      setScriptState({
        loading: false,
        result: "Please provide at least one selling point.",
      });
      return;
    }

    setScriptState({ loading: true, result: "Generating script and storyboard..." });

    const response = await fetch("/api/ai/scripts/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId,
        productName: generationPayload.productName,
        sellingPoints,
        targetAudience: generationPayload.targetAudience,
        tone: generationPayload.tone,
        durationSec: Number(generationPayload.durationSec),
      }),
    });

    const data = toJsonRecord(await readJsonResponse(response));

    if (response.ok) {
      if (typeof data.scriptId === "string") {
        setScriptId(data.scriptId);
      }

      if (isGeneratedStructuredJson(data.structuredJson)) {
        const structured = data.structuredJson;
        const derivedSellingPoints = parseSellingPoints(generationPayload.sellingPointsText).join(", ");

        setScriptPayload({
          title: structured.title,
          hook: structured.hook,
          sellingPoints: derivedSellingPoints,
          storyboard: toStoryboardText(structured.shots),
          cta: structured.cta,
        });
        setTtsText(structured.voiceover);
      }

      setScriptState({ loading: false, result: formatJson(data) });
      return;
    }

    setScriptState({ loading: false, result: `Error ${response.status}\n${formatJson(data)}` });
  }

  async function handleUpdateScript() {
    if (!scriptId.trim()) {
      setScriptState({
        loading: false,
        result: "Please generate a script first or fill in an existing script ID.",
      });
      return;
    }

    setScriptState({ loading: true, result: "Updating script..." });

    const response = await fetch(`/api/scripts/${scriptId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(scriptPayload),
    });

    const data = await readJsonResponse(response);

    if (response.ok) {
      setScriptState({ loading: false, result: formatJson(data) });
      return;
    }

    setScriptState({ loading: false, result: `Error ${response.status}\n${formatJson(data)}` });
  }

  async function handleSynthesizeTts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setTtsState({ loading: true, result: "Synthesizing voiceover..." });

    const response = await fetch("/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        scriptText: ttsText,
        voiceStyle,
      }),
    });

    const data = toJsonRecord(await readJsonResponse(response));

    if (response.ok) {
      const url = typeof data.url === "string" ? data.url : "";
      setTtsUrl(url);
      setTtsState({ loading: false, result: formatJson(data) });
      return;
    }

    setTtsState({ loading: false, result: `Error ${response.status}\n${formatJson(data)}` });
  }

  async function handleCreateRenderJob() {
    if (!scriptId.trim()) {
      setRenderState({ loading: false, result: "scriptId is required to generate video." });
      return;
    }

    setRenderState({ loading: true, result: "Queueing SeaDance video generation..." });

    const response = await fetch("/api/videos/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId,
        scriptId,
        voiceStyle,
        aspectRatio: renderAspectRatio,
      }),
    });

    const data = await readJsonResponse(response);

    if (response.ok) {
      setRenderState({ loading: false, result: formatJson(data) });
      return;
    }

    setRenderState({ loading: false, result: `Error ${response.status}\n${formatJson(data)}` });
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,#fce2b8_0%,#f6f7fb_45%),radial-gradient(circle_at_85%_20%,#d4f2eb_0%,#f6f7fb_35%)] pb-20">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-8 md:px-8">
        <section className="rounded-2xl border border-slate-200/80 bg-white/85 p-6 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            3D Print Promo Workflow
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900 md:text-4xl">
            OpenAI + SeaDance Workbench
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
            Upload assets, generate copywriting and storyboard with an OpenAI-compatible model,
            edit script text, then queue SeaDance video generation from one screen.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-[180px_1fr] md:items-center">
            <label htmlFor="projectId" className="text-sm font-medium text-slate-700">
              Project ID
            </label>
            <input
              id="projectId"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            />
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">1. Upload Asset</h2>
            <p className="mt-1 text-sm text-slate-600">Upload one source image for current project.</p>
            <form className="mt-4 space-y-3" onSubmit={handleUploadAsset}>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setAssetFile(event.target.files?.[0] ?? null)}
                className="block w-full rounded-xl border border-slate-300 bg-white p-2 text-sm"
              />
              <button
                type="submit"
                disabled={assetState.loading}
                className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {assetState.loading ? "Uploading..." : "Upload Image"}
              </button>
            </form>
            {assetUrl ? (
              <div className="mt-4 rounded-xl border border-slate-200 p-3">
                <p className="mb-2 text-xs font-medium text-slate-500">Preview</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={assetUrl} alt="Uploaded asset preview" className="max-h-60 w-full rounded-lg object-cover" />
              </div>
            ) : null}
            <pre className="mt-4 max-h-44 overflow-auto rounded-xl bg-slate-950 p-3 text-xs leading-5 text-slate-100">
              {assetState.result || "No response yet."}
            </pre>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">2. Generate and Edit Script</h2>
            <p className="mt-1 text-sm text-slate-600">
              Generate strict JSON script/storyboard via OpenAI-compatible API, then edit copy/storyboard.
            </p>
            <form className="mt-4 space-y-3" onSubmit={handleGenerateScript}>
              <input
                value={generationPayload.productName}
                onChange={(event) =>
                  setGenerationPayload((prev) => ({
                    ...prev,
                    productName: event.target.value,
                  }))
                }
                placeholder="Product name"
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              />
              <textarea
                value={generationPayload.sellingPointsText}
                onChange={(event) =>
                  setGenerationPayload((prev) => ({
                    ...prev,
                    sellingPointsText: event.target.value,
                  }))
                }
                placeholder="Selling points (comma or newline separated)"
                rows={2}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={generationPayload.targetAudience}
                onChange={(event) =>
                  setGenerationPayload((prev) => ({
                    ...prev,
                    targetAudience: event.target.value,
                  }))
                }
                placeholder="Target audience"
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={generationPayload.tone}
                  onChange={(event) =>
                    setGenerationPayload((prev) => ({
                      ...prev,
                      tone: event.target.value,
                    }))
                  }
                  placeholder="Tone"
                  className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                />
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={generationPayload.durationSec}
                  onChange={(event) =>
                    setGenerationPayload((prev) => ({
                      ...prev,
                      durationSec: Number(event.target.value),
                    }))
                  }
                  placeholder="Duration (sec)"
                  className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={scriptState.loading}
                className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
              >
                {scriptState.loading ? "Generating..." : "Generate Script + Storyboard"}
              </button>
            </form>

            <div className="mt-5 border-t border-slate-200 pt-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Editable Fields</p>
              <div className="mt-3 space-y-3">
                <input
                  value={scriptPayload.title}
                  onChange={(event) =>
                    setScriptPayload((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Title"
                  className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                />
                <textarea
                  value={scriptPayload.hook}
                  onChange={(event) =>
                    setScriptPayload((prev) => ({
                      ...prev,
                      hook: event.target.value,
                    }))
                  }
                  placeholder="Hook"
                  rows={2}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <textarea
                  value={scriptPayload.sellingPoints}
                  onChange={(event) =>
                    setScriptPayload((prev) => ({
                      ...prev,
                      sellingPoints: event.target.value,
                    }))
                  }
                  placeholder="Selling points"
                  rows={2}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <textarea
                  value={scriptPayload.storyboard}
                  onChange={(event) =>
                    setScriptPayload((prev) => ({
                      ...prev,
                      storyboard: event.target.value,
                    }))
                  }
                  placeholder="Storyboard"
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={scriptPayload.cta}
                  onChange={(event) =>
                    setScriptPayload((prev) => ({
                      ...prev,
                      cta: event.target.value,
                    }))
                  }
                  placeholder="CTA"
                  className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
                />
                <button
                  type="button"
                  onClick={handleUpdateScript}
                  disabled={scriptState.loading || !scriptId.trim()}
                  className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                >
                  Save Script Edits
                </button>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="scriptId" className="mb-1 block text-xs font-medium text-slate-500">
                Script ID
              </label>
              <input
                id="scriptId"
                value={scriptId}
                onChange={(event) => setScriptId(event.target.value)}
                placeholder="scr_xxx"
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              />
            </div>
            <pre className="mt-4 max-h-44 overflow-auto rounded-xl bg-slate-950 p-3 text-xs leading-5 text-slate-100">
              {scriptState.result || "No response yet."}
            </pre>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">3. TTS Synthesis</h2>
            <p className="mt-1 text-sm text-slate-600">
              Generate voiceover audio from script text. Voiceover is auto-filled after AI generation.
            </p>
            <form className="mt-4 space-y-3" onSubmit={handleSynthesizeTts}>
              <textarea
                value={ttsText}
                onChange={(event) => setTtsText(event.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={voiceStyle}
                onChange={(event) => setVoiceStyle(event.target.value)}
                placeholder="Voice style"
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              />
              <button
                type="submit"
                disabled={ttsState.loading}
                className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
              >
                {ttsState.loading ? "Synthesizing..." : "Generate Voice"}
              </button>
            </form>
            {ttsUrl ? <audio className="mt-4 w-full" controls src={ttsUrl} /> : null}
            <pre className="mt-4 max-h-44 overflow-auto rounded-xl bg-slate-950 p-3 text-xs leading-5 text-slate-100">
              {ttsState.result || "No response yet."}
            </pre>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">4. Generate Video</h2>
            <p className="mt-1 text-sm text-slate-600">Submit SeaDance video task through BullMQ queue.</p>
            <div className="mt-4 space-y-3">
              <select
                value={renderAspectRatio}
                onChange={(event) => setRenderAspectRatio(event.target.value as "9:16" | "16:9")}
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"
              >
                <option value="9:16">9:16 (vertical)</option>
                <option value="16:9">16:9 (horizontal)</option>
              </select>
              <button
                type="button"
                onClick={handleCreateRenderJob}
                disabled={!canCreateRenderJob || renderState.loading}
                className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
              >
                {renderState.loading ? "Queueing..." : "Queue SeaDance Video"}
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Requires a valid <span className="font-semibold">Script ID</span> from step 2.
            </p>
            <pre className="mt-4 max-h-44 overflow-auto rounded-xl bg-slate-950 p-3 text-xs leading-5 text-slate-100">
              {renderState.result || "No response yet."}
            </pre>
          </article>
        </section>
      </main>
    </div>
  );
}
