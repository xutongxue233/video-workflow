import type {
  Dict,
  EditableShot,
  GeneratedShot,
  GeneratedStructuredJson,
  JsonRecord,
  Locale,
  RenderStatus,
  StepView,
} from "./workspace-types";
import { localize } from "./workspace-copy";

export function toJsonRecord(data: unknown): JsonRecord {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {};
  }
  return data as JsonRecord;
}

export function isGeneratedStructuredJson(data: unknown): data is GeneratedStructuredJson {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return false;
  }
  const record = data as JsonRecord;
  return (
    typeof record.title === "string"
    && typeof record.hook === "string"
    && typeof record.voiceover === "string"
    && typeof record.cta === "string"
    && Array.isArray(record.shots)
  );
}

export function toStoryboardText(shots: GeneratedShot[]): string {
  return shots.map((shot) => `${shot.index}. ${shot.visual} | ${shot.caption} | ${shot.camera}`).join("\n");
}

export function normalizeEditableShots(shots: EditableShot[]): EditableShot[] {
  const cleaned = shots
    .map((shot) => ({
      ...shot,
      durationSec: Math.max(1, Math.min(60, Math.floor(Number(shot.durationSec) || 5))),
      visual: shot.visual.trim(),
      caption: shot.caption.trim(),
      camera: shot.camera.trim(),
    }))
    .filter((shot) => shot.visual || shot.caption || shot.camera);

  if (cleaned.length > 0) {
    return cleaned;
  }

  return [{
    id: `shot-${Date.now()}`,
    durationSec: 5,
    visual: "",
    caption: "",
    camera: "",
  }];
}

export function toStoryboardTextFromEditableShots(shots: EditableShot[]): string {
  const normalized = normalizeEditableShots(shots);
  return normalized
    .map((shot, index) => `${index + 1}. ${shot.visual} | ${shot.caption} | ${shot.camera}`)
    .join("\n");
}

export function toGeneratedShotsFromEditableShots(shots: EditableShot[]): GeneratedShot[] {
  return normalizeEditableShots(shots).map((shot, index) => ({
    index: index + 1,
    durationSec: shot.durationSec,
    visual: shot.visual || "product close-up",
    caption: shot.caption || "",
    camera: shot.camera || "static",
  }));
}

export function parseStoryboardToEditableShots(storyboard: string): EditableShot[] {
  const lines = storyboard
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed = lines.map((line, index) => {
    const content = line.replace(/^\d+\.\s*/, "");
    const [visual = "", caption = "", camera = ""] = content.split("|").map((part) => part.trim());
    return {
      id: `parsed-${index}-${Date.now()}`,
      durationSec: 5,
      visual,
      caption,
      camera,
    };
  });

  return parsed.length > 0
    ? parsed
    : [{
      id: `shot-${Date.now()}`,
      durationSec: 5,
      visual: "",
      caption: "",
      camera: "",
    }];
}

export function generatedShotsToEditableShots(shots: GeneratedShot[]): EditableShot[] {
  return shots.length > 0
    ? shots.map((shot, index) => ({
      id: `shot-${index}-${Date.now()}`,
      durationSec: Math.max(1, Math.min(60, Math.floor(Number(shot.durationSec) || 5))),
      visual: shot.visual,
      caption: shot.caption,
      camera: shot.camera,
    }))
    : [{
      id: `shot-${Date.now()}`,
      durationSec: 5,
      visual: "",
      caption: "",
      camera: "",
    }];
}

export function parseSellingPoints(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function normalizeFileUrl(url: string): string {
  if (url.startsWith("/files/")) {
    return `/api/files/${url.slice("/files/".length)}`;
  }
  return url;
}

export function toAbsoluteFileUrl(url: string): string {
  const normalized = normalizeFileUrl(url);
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  if (typeof window === "undefined") {
    return normalized;
  }

  return new URL(normalized, window.location.origin).toString();
}

export async function readJsonResponse(response: Response): Promise<unknown> {
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

export function extractApiMessage(data: unknown): string {
  const record = toJsonRecord(data);
  for (const key of ["message", "error", "detail"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

export function formatRequestErrorMessage(
  locale: Locale,
  status: number,
  fallbackZh: string,
  fallbackEn: string,
  data: unknown,
): string {
  const apiMessage = extractApiMessage(data);
  if (apiMessage) {
    return localize(locale, `${fallbackZh}：${apiMessage}`, `${fallbackEn}: ${apiMessage}`);
  }
  return localize(
    locale,
    `${fallbackZh}（状态码 ${status}）`,
    `${fallbackEn} (status ${status})`,
  );
}

export function toMessageAriaRole(message: string): "alert" | "status" {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("失败")
    || normalized.includes("错误")
    || normalized.includes("invalid")
    || normalized.includes("failed")
    || normalized.includes("error")
  ) {
    return "alert";
  }
  return "status";
}

export function toRenderStatusLabel(locale: Locale, status: RenderStatus): string {
  switch (status) {
    case "QUEUED":
      return localize(locale, "排队中", "Queued");
    case "RUNNING":
    case "PROCESSING":
      return localize(locale, "处理中", "Processing");
    case "SUCCEEDED":
      return localize(locale, "已完成", "Completed");
    case "FAILED":
      return localize(locale, "失败", "Failed");
    case "CANCELED":
      return localize(locale, "已取消", "Canceled");
    default:
      return status || localize(locale, "未知状态", "Unknown");
  }
}

export function toRenderStatusChipClass(status: RenderStatus): string {
  switch (status) {
    case "SUCCEEDED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "FAILED":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "CANCELED":
      return "border-slate-300 bg-slate-100 text-slate-600";
    case "RUNNING":
    case "PROCESSING":
      return "border-teal-200 bg-teal-50 text-teal-700";
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

export function getBadge(dict: Dict, step: StepView, isActive: boolean): { text: string; cls: string } {
  if (step.done) {
    return { text: dict.stepState.done, cls: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  }
  if (step.blocked) {
    return { text: dict.stepState.blocked, cls: "border-amber-200 bg-amber-50 text-amber-700" };
  }
  if (isActive) {
    return { text: dict.stepState.active, cls: "border-teal-200 bg-teal-50 text-teal-700" };
  }
  return { text: dict.stepState.pending, cls: "border-slate-200 bg-slate-100 text-slate-600" };
}
