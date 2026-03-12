export type MaterialAssetRecord = {
  id: string;
  projectId: string;
  fileName: string | null;
  url: string;
  createdAt: string;
};

export function buildProjectScopedAssetsUrl(projectId: string, limit: number): string {
  const normalizedProjectId = projectId.trim();
  const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 60;

  return `/api/assets?projectId=${encodeURIComponent(normalizedProjectId)}&limit=${normalizedLimit}`;
}

export function filterMaterialAssetsByProject(
  items: MaterialAssetRecord[],
  projectId: string,
): MaterialAssetRecord[] {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) {
    return [];
  }

  return items.filter((item) => item.projectId === normalizedProjectId);
}
