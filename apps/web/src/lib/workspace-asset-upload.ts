import type {
  CreateWorkspaceAssetIntentInput,
  WorkspaceSummary,
  WorkspaceUploadIntent,
} from "@orbit/shared/workspaces"
import { apiFetch } from "./api-client"

async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text()
  return text ? (JSON.parse(text) as T) : null
}

async function cancelWorkspaceAssetIntent(identifier: string, assetId: string) {
  try {
    await apiFetch(`/api/workspaces/${identifier}/assets/${assetId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
  } catch {
    // Best-effort cleanup only.
  }
}

export async function requestWorkspaceAssetIntent(
  identifier: string,
  input: CreateWorkspaceAssetIntentInput
) {
  const response = await apiFetch(`/api/workspaces/${identifier}/assets/intents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const body = await readJson<{ message?: string }>(response)
    throw new Error(body?.message ?? "Unable to create an upload intent.")
  }

  const intent = await readJson<WorkspaceUploadIntent>(response)

  if (!intent) {
    throw new Error("Upload intent response was empty.")
  }

  return intent
}

function uploadFileToSignedUrl(
  intent: WorkspaceUploadIntent,
  file: File,
  onProgress?: (percentage: number) => void
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", intent.uploadUrl)

    for (const [name, value] of Object.entries(intent.headers)) {
      xhr.setRequestHeader(name, value)
    }

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) {
        return
      }

      onProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)))
    })

    xhr.addEventListener("error", () => {
      reject(
        new Error(
          "The browser could not upload directly to R2. Check the bucket CORS policy."
        )
      )
    })

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100)
        resolve()
        return
      }

      reject(
        new Error(
          "Direct upload failed. Check the R2 bucket CORS policy and presigned upload settings."
        )
      )
    })

    xhr.send(file)
  })
}

export async function finalizeWorkspaceAsset(
  identifier: string,
  assetId: string
) {
  const response = await apiFetch(`/api/workspaces/${identifier}/assets/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assetId }),
  })

  if (!response.ok) {
    const body = await readJson<{ message?: string }>(response)
    throw new Error(body?.message ?? "The uploaded asset could not be finalized.")
  }

  const workspace = await readJson<WorkspaceSummary>(response)

  if (!workspace) {
    throw new Error("Finalize response did not include an updated workspace.")
  }

  return workspace
}

export async function uploadWorkspaceAssetFromIntent(input: {
  identifier: string
  intent: WorkspaceUploadIntent
  file: File
  onProgress?: (percentage: number) => void
}) {
  try {
    await uploadFileToSignedUrl(input.intent, input.file, input.onProgress)
  } catch (error) {
    await cancelWorkspaceAssetIntent(input.identifier, input.intent.assetId)
    throw error
  }

  return finalizeWorkspaceAsset(input.identifier, input.intent.assetId)
}

export async function uploadWorkspaceAsset(input: {
  identifier: string
  asset: CreateWorkspaceAssetIntentInput
  file: File
  onProgress?: (percentage: number) => void
}) {
  const intent = await requestWorkspaceAssetIntent(input.identifier, input.asset)
  return uploadWorkspaceAssetFromIntent({
    identifier: input.identifier,
    intent,
    file: input.file,
    onProgress: input.onProgress,
  })
}
