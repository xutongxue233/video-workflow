export const WORKFLOW_DEFAULT_PROJECT_ID = "proj_demo";

export function normalizeProjectIdInput(value: string): string {
  const normalized = value.trim();
  return normalized || WORKFLOW_DEFAULT_PROJECT_ID;
}

export function buildProjectDetailPath(projectId: string): string {
  const normalized = normalizeProjectIdInput(projectId);
  return `/projects/${encodeURIComponent(normalized)}`;
}
