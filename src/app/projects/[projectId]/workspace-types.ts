export type Locale = "zh-CN" | "en-US";
export type StepId = "materials" | "script" | "video";
export type RenderStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED" | "PROCESSING" | string;

export type RequestState = { loading: boolean; result: string };
export type JsonRecord = Record<string, unknown>;

export type GeneratedShot = {
  index: number;
  durationSec: number;
  visual: string;
  caption: string;
  camera: string;
};

export type EditableShot = {
  id: string;
  durationSec: number;
  visual: string;
  caption: string;
  camera: string;
};

export type GeneratedStructuredJson = {
  title: string;
  hook: string;
  voiceover: string;
  cta: string;
  shots: GeneratedShot[];
};

export type StepView = {
  id: StepId;
  title: string;
  hint: string;
  criteria?: string;
  done: boolean;
  blocked: boolean;
};

export type ProjectSummaryItem = {
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

export type MaterialAssetItem = {
  id: string;
  projectId: string;
  fileName: string | null;
  url: string;
  createdAt: string;
};

export type PromptTemplateItem = {
  id: string;
  projectId: string;
  name: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
};

export type ScriptHistoryItem = {
  id: string;
  projectId: string;
  title: string | null;
  hook: string | null;
  cta: string | null;
  generatorModel: string | null;
  updatedAt: string;
};

export type RenderHistoryItem = {
  id: string;
  projectId: string;
  status: RenderStatus;
  provider: string | null;
  scriptId: string | null;
  videoUrl: string | null;
  progress?: {
    completed: number;
    total: number;
    failed: number;
  } | null;
  referenceAssets?: Array<{
    id: string;
    projectId: string;
    fileName: string | null;
    url: string;
  }>;
  updatedAt: string;
};

export type RenderShotStatusItem = {
  shotIndex: number;
  status: RenderStatus;
  errorMessage?: string;
};

export type PreviewDialogState = {
  kind: "image" | "video";
  url: string;
  title: string;
};

export type Dict = {
  localeLabel: string;
  modelSettings: string;
  backToHome: string;
  textModelProvider: string;
  imageModelProvider: string;
  videoModelProvider: string;
  manualModel: string;
  modelUnknown: string;
  providerUnknown: string;
  queuedFallback: string;
  languages: Record<Locale, string>;
  heroTag: string;
  heroTitle: string;
  heroDesc: string;
  completion: string;
  uiLang: string;
  contentLang: string;
  projectIdLabel: string;
  projectIdHint: string;
  progressTitle: string;
  progressHint: string;
  quickLang: string;
  responseTitle: string;
  responseEmpty: string;
  errorPrefix: string;
  stepTag: string;
  stepNames: Record<StepId, string>;
  stepHints: Record<StepId, string>;
  stepState: {
    done: string;
    blocked: string;
    active: string;
    pending: string;
  };
  asset: {
    title: string;
    desc: string;
    fileLabel: string;
    submit: string;
    submitting: string;
    chooseFile: string;
    preview: string;
  };
  script: {
    title: string;
    desc: string;
    product: string;
    productPh: string;
    points: string;
    pointsPh: string;
    audience: string;
    audiencePh: string;
    tone: string;
    tonePh: string;
    duration: string;
    outLang: string;
    submit: string;
    submitting: string;
    editTitle: string;
    fieldTitle: string;
    hook: string;
    sellPoints: string;
    storyboard: string;
    cta: string;
    save: string;
    saving: string;
    scriptId: string;
    scriptIdPh: string;
    scriptIdHint: string;
    needPoints: string;
    needScriptId: string;
  };
  video: {
    title: string;
    desc: string;
    ratio: string;
    voiceStyle: string;
    voiceStylePh: string;
    vertical: string;
    horizontal: string;
    submit: string;
    submitting: string;
    needScriptId: string;
    hint: string;
    jobId: string;
    status: string;
    polling: string;
    retry: string;
    retrying: string;
    shotStatus: string;
    ready: string;
  };
  materialGen: {
    title: string;
    desc: string;
    prompt: string;
    promptPh: string;
    templateName: string;
    templateNamePh: string;
    saveTemplate: string;
    savingTemplate: string;
    chooseTemplate: string;
    prototypeFile: string;
    refFiles: string;
    outputCount: string;
    size: string;
    sizePh: string;
    submit: string;
    submitting: string;
    needPrototype: string;
    needPrompt: string;
    generated: string;
  };
};

export type GenerationPayload = {
  productName: string;
  sellingPointsText: string;
  targetAudience: string;
  tone: string;
  durationSec: number;
};

export type ScriptJobGroup = {
  key: string;
  script: ScriptHistoryItem | null;
  jobs: RenderHistoryItem[];
  latestTs: number;
};
