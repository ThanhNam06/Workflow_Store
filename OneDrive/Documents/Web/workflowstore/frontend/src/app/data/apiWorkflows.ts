import { apiGet } from "../api/api";
import type { WorkflowProduct, Platform, WorkflowCategory } from "./workflowData";
import { allWorkflows, getWorkflowsByCategory as getWorkflowsByCategorySync, getWorkflowById as getWorkflowByIdSync } from "./workflowData";

// Fetch all workflows from backend; fallback to local `allWorkflows` when API unavailable or returns empty
export async function fetchAllWorkflows(): Promise<WorkflowProduct[]> {
  try {
    const data = await apiGet('/api/workflows')
    if (!Array.isArray(data) || data.length === 0) return allWorkflows
    return data
  } catch (err) {
    console.warn('fetchAllWorkflows: using local fallback', err)
    return allWorkflows
  }
}

export async function fetchWorkflowsByCategory(platform: Platform, category: WorkflowCategory): Promise<WorkflowProduct[]> {
  const all = await fetchAllWorkflows()
  // If items include platform field, filter by platform/category; otherwise, fall back to local sync function
  if (all.some((w: any) => typeof w.platform !== 'undefined')) {
    return all.filter((w: any) => w.platform === platform && w.category === category)
  }
  return getWorkflowsByCategorySync(platform, category)
}

export async function fetchWorkflowById(id: string): Promise<WorkflowProduct | undefined> {
  try {
    const data = await apiGet(`/api/workflows/${id}`)
    if (data && typeof data.id !== 'undefined') return data
  } catch (err) {
    console.warn('fetchWorkflowById failed, falling back', err)
  }
  return getWorkflowByIdSync(id)
}
