import type { WorkspaceSummary } from "@orbit/shared/workspaces"

const WORKSPACE_UPDATED_EVENT = "orbit:workspace-updated"

type WorkspaceUpdatedDetail = {
  workspace: WorkspaceSummary
}

export function emitWorkspaceUpdated(workspace: WorkspaceSummary) {
  if (typeof window === "undefined") {
    return
  }

  window.dispatchEvent(
    new CustomEvent<WorkspaceUpdatedDetail>(WORKSPACE_UPDATED_EVENT, {
      detail: { workspace },
    })
  )
}

export function onWorkspaceUpdated(
  callback: (workspace: WorkspaceSummary) => void
) {
  if (typeof window === "undefined") {
    return () => {}
  }

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<WorkspaceUpdatedDetail>).detail

    if (detail?.workspace) {
      callback(detail.workspace)
    }
  }

  window.addEventListener(WORKSPACE_UPDATED_EVENT, handler)
  return () => window.removeEventListener(WORKSPACE_UPDATED_EVENT, handler)
}
