import { useEffect, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  MAX_WORKSPACE_IMAGE_BYTES,
  workspaceImageMimeTypes,
  type WorkspaceSummary,
} from "@orbit/shared/workspaces"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete01Icon, Image02Icon } from "@hugeicons/core-free-icons"

import { apiFetch } from "@/lib/api-client"
import { emitWorkspaceUpdated } from "@/lib/workspace-events"
import { uploadWorkspaceAsset } from "@/lib/workspace-asset-upload"
import { Button } from "@/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/card"
import { Input } from "@/components/input"
import { Label } from "@/components/label"
import { Spinner } from "@/components/spinner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/alert-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert"

export const Route = createFileRoute("/app/$identifier/settings")({
  component: WorkspaceSettingsPage,
})

async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text()
  return text ? (JSON.parse(text) as T) : null
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  }

  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

function WorkspaceSettingsPage() {
  const { identifier } = Route.useParams()
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [nameError, setNameError] = useState<string | null>(null)
  const [savingName, setSavingName] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [imageSuccess, setImageSuccess] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteStep, setDeleteStep] = useState<"initial" | "code-sent" | "confirm">("initial")
  const [deletionCodeInput, setDeletionCodeInput] = useState("")
  const [identifierInput, setIdentifierInput] = useState("")
  const [deletingWorkspace, setDeletingWorkspace] = useState(false)
  const [deletionError, setDeletionError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadWorkspace() {
      const response = await apiFetch(`/api/workspaces/${identifier}`)
      const payload = response.ok
        ? await readJson<WorkspaceSummary>(response)
        : null
      if (mounted) {
        setWorkspace(payload)
        setName(payload?.name ?? "")
        setLoading(false)
      }
    }

    void loadWorkspace()

    return () => {
      mounted = false
    }
  }, [identifier])

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    setNameError(null)
    setSaveSuccess(false)

    if (!name.trim()) {
      setNameError("Workspace name is required")
      return
    }

    if (name === workspace?.name) {
      return
    }

    setSavingName(true)
    try {
      const response = await apiFetch(`/api/workspaces/${identifier}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })

      if (!response.ok) {
        const body = await readJson<{ message?: string }>(response)
        throw new Error(body?.message ?? "Failed to update workspace name")
      }

      const updated = await readJson<WorkspaceSummary>(response)
      if (updated) {
        setWorkspace(updated)
        emitWorkspaceUpdated(updated)
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    } catch (error) {
      setNameError(
        error instanceof Error ? error.message : "Failed to update workspace name"
      )
    } finally {
      setSavingName(false)
    }
  }

  function handleImageSelection(file: File | null) {
    setImageError(null)
    setImageSuccess(null)
    setUploadProgress(0)
    setSelectedImage(file)
  }

  async function handleUploadImage(e: React.FormEvent) {
    e.preventDefault()
    setImageError(null)
    setImageSuccess(null)

    if (!selectedImage) {
      setImageError("Choose an image file first.")
      return
    }

    if (!workspace) {
      setImageError("Workspace settings are still loading.")
      return
    }

    if (!workspace.uploadsAllowed) {
      setImageError(workspace.uploadBlockReason ?? "Uploads are currently blocked.")
      return
    }

    if (
      !workspaceImageMimeTypes.includes(
        selectedImage.type as (typeof workspaceImageMimeTypes)[number]
      )
    ) {
      setImageError("Workspace images must be PNG, JPEG, GIF, or WebP.")
      return
    }

    if (selectedImage.size > MAX_WORKSPACE_IMAGE_BYTES) {
      setImageError(
        `Workspace images must be ${formatBytes(MAX_WORKSPACE_IMAGE_BYTES)} or smaller.`
      )
      return
    }

    setUploadingImage(true)

    try {
      const updated = await uploadWorkspaceAsset({
        identifier,
        asset: {
          kind: "workspace_logo",
          fileName: selectedImage.name,
          contentType: selectedImage.type,
          sizeBytes: selectedImage.size,
        },
        file: selectedImage,
        onProgress: setUploadProgress,
      })

      setWorkspace(updated)
      emitWorkspaceUpdated(updated)
      setSelectedImage(null)
      setImageSuccess("Workspace image updated.")
    } catch (error) {
      setImageError(
        error instanceof Error ? error.message : "Workspace image upload failed."
      )
    } finally {
      setUploadingImage(false)
    }
  }

  async function handleRequestDeletion() {
    setDeletionError(null)
    setDeletingWorkspace(true)

    try {
      const response = await apiFetch(
        `/api/workspaces/${identifier}/deletion/request`,
        { method: "POST" }
      )

      if (!response.ok) {
        const body = await readJson<{ message?: string }>(response)
        throw new Error(body?.message ?? "Failed to request deletion")
      }

      setDeleteStep("code-sent")
    } catch (error) {
      setDeletionError(
        error instanceof Error ? error.message : "Failed to request deletion"
      )
    } finally {
      setDeletingWorkspace(false)
    }
  }

  async function handleConfirmDeletion(e: React.FormEvent) {
    e.preventDefault()
    setDeletionError(null)

    if (identifierInput !== identifier) {
      setDeletionError("Workspace identifier does not match")
      return
    }

    if (!deletionCodeInput.trim()) {
      setDeletionError("Verification code is required")
      return
    }

    setDeletingWorkspace(true)

    try {
      const response = await apiFetch(
        `/api/workspaces/${identifier}/deletion/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: deletionCodeInput.trim() }),
        }
      )

      if (!response.ok) {
        const body = await readJson<{ message?: string }>(response)
        throw new Error(body?.message ?? "Failed to delete workspace")
      }

      // Redirect to workspaces list
      window.location.href = "/app"
    } catch (error) {
      setDeletionError(
        error instanceof Error ? error.message : "Failed to delete workspace"
      )
    } finally {
      setDeletingWorkspace(false)
    }
  }

  function handleCloseDeleteDialog() {
    if (!deletingWorkspace) {
      setDeleteDialogOpen(false)
      setDeleteStep("initial")
      setDeletionCodeInput("")
      setIdentifierInput("")
      setDeletionError(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Loading settings...
      </div>
    )
  }

  if (!workspace) return null

  return (
    <div className="space-y-6">
      {/* Basic Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Workspace settings</CardTitle>
          <CardDescription>
            Update your workspace name and appearance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Name Section */}
          <form onSubmit={handleSaveName} className="space-y-3">
            <div>
              <Label htmlFor="workspace-name">Workspace name</Label>
              <Input
                id="workspace-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setNameError(null)
                  setSaveSuccess(false)
                }}
                placeholder="Enter workspace name"
                className="mt-1"
              />
              {nameError && (
                <p className="mt-1 text-sm text-destructive">{nameError}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                disabled={savingName || name === workspace.name}
                className="gap-2"
              >
                {savingName && <Spinner className="size-3" />}
                Save changes
              </Button>
              {saveSuccess && (
                <span className="text-sm text-green-600">Saved successfully</span>
              )}
            </div>
          </form>

          <form onSubmit={handleUploadImage} className="space-y-4 border-t pt-6">
            <div>
              <Label>Workspace image</Label>
              <p className="text-sm text-muted-foreground">
                Upload a workspace-scoped logo directly to R2 using a short-lived authenticated upload URL.
              </p>
            </div>
            <div className="flex flex-col gap-4 md:flex-row md:items-start">
              <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted">
                {workspace.imageUrl ? (
                  <img
                    src={workspace.imageUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <HugeiconsIcon
                    icon={Image02Icon}
                    className="size-8 text-muted-foreground"
                  />
                )}
              </div>
              <div className="flex-1 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="workspace-image">Upload new image</Label>
                  <Input
                    id="workspace-image"
                    type="file"
                    accept={workspaceImageMimeTypes.join(",")}
                    disabled={uploadingImage}
                    onChange={(event) =>
                      handleImageSelection(event.target.files?.[0] ?? null)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Allowed formats: PNG, JPEG, GIF, WebP. Max {formatBytes(MAX_WORKSPACE_IMAGE_BYTES)}.
                  </p>
                  {selectedImage ? (
                    <p className="text-xs text-muted-foreground">
                      Selected: {selectedImage.name} ({formatBytes(selectedImage.size)})
                    </p>
                  ) : null}
                </div>
                {imageError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Upload failed</AlertTitle>
                    <AlertDescription>{imageError}</AlertDescription>
                  </Alert>
                ) : null}
                {imageSuccess ? (
                  <Alert>
                    <AlertTitle>Upload complete</AlertTitle>
                    <AlertDescription>{imageSuccess}</AlertDescription>
                  </Alert>
                ) : null}
                {uploadingImage ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Spinner className="size-4" />
                      Uploading to R2 and finalizing the workspace image.
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Progress: {uploadProgress}%
                    </p>
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  <Button
                    type="submit"
                    disabled={uploadingImage || !selectedImage || !workspace.uploadsAllowed}
                    className="gap-2"
                  >
                    {uploadingImage && <Spinner className="size-3" />}
                    Upload image
                  </Button>
                  {workspace.uploadsAllowed === false ? (
                    <p className="text-sm text-destructive">
                      {workspace.uploadBlockReason ?? "Uploads are currently blocked."}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-destructive">
            Danger zone
          </CardTitle>
          <CardDescription>
            Irreversible actions for this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => setDeleteDialogOpen(true)}
            className="gap-2"
          >
            <HugeiconsIcon icon={Delete01Icon} className="size-4" />
            Delete workspace
          </Button>
        </CardContent>
      </Card>

      {/* Delete Workspace Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={handleCloseDeleteDialog}>
        <AlertDialogContent className="max-w-md">
          {deleteStep === "initial" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. All workspace data will be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {deletionError && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{deletionError}</AlertDescription>
                </Alert>
              )}
              <div className="flex gap-3">
                <AlertDialogCancel disabled={deletingWorkspace}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleRequestDeletion}
                  disabled={deletingWorkspace}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deletingWorkspace && <Spinner className="mr-2 size-3" />}
                  Send verification code
                </AlertDialogAction>
              </div>
            </>
          )}

          {deleteStep === "code-sent" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Verify deletion</AlertDialogTitle>
                <AlertDialogDescription>
                  A 4-letter verification code has been sent to your email. Enter it below to confirm workspace deletion.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <form onSubmit={handleConfirmDeletion} className="space-y-4">
                {deletionError && (
                  <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{deletionError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="verification-code">Verification code</Label>
                  <Input
                    id="verification-code"
                    value={deletionCodeInput}
                    onChange={(e) => setDeletionCodeInput(e.target.value.toUpperCase())}
                    placeholder="e.g., A1B2"
                    maxLength={4}
                    className="font-mono text-center text-lg tracking-widest"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workspace-identifier">
                    Type workspace identifier to confirm
                  </Label>
                  <Input
                    id="workspace-identifier"
                    value={identifierInput}
                    onChange={(e) => setIdentifierInput(e.target.value)}
                    placeholder={identifier}
                  />
                  {identifierInput !== identifier && identifierInput && (
                    <p className="text-sm text-destructive">
                      Identifier does not match
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  <AlertDialogCancel disabled={deletingWorkspace}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    type="submit"
                    disabled={
                      deletingWorkspace ||
                      !deletionCodeInput.trim() ||
                      identifierInput !== identifier
                    }
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deletingWorkspace && <Spinner className="mr-2 size-3" />}
                    Delete workspace
                  </AlertDialogAction>
                </div>
              </form>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
