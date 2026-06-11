import { useCallback, useEffect, useMemo, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { formatDistanceToNow } from "date-fns"
import type { AdminWorkspaceList, AdminWorkspaceRecord } from "@orbit/shared"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Delete02Icon,
  StopCircleIcon,
  RefreshIcon,
  SearchList01Icon,
} from "@hugeicons/core-free-icons"

import { AdminShell } from "@/components/features/admin/shell"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/alert-dialog"
import { Badge } from "@/components/badge"
import { Button } from "@/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/card"
import { Input } from "@/components/input"
import { Spinner } from "@/components/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/table"
import { apiFetch } from "@/lib/api-client"

export const Route = createFileRoute("/admin/workspaces")({
  component: AdminWorkspacesPage,
})

function AdminWorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<AdminWorkspaceRecord[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminWorkspaceRecord | null>(null)
  const [confirmIdentifier, setConfirmIdentifier] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const loadWorkspaces = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await apiFetch("/api/admin/workspaces")
      if (!response.ok) {
        const body = await safeJson(response)
        throw new Error(
          body?.message ?? `Failed to load workspaces (${response.status})`
        )
      }

      const payload = (await response.json()) as AdminWorkspaceList
      setWorkspaces(payload.workspaces)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load workspaces."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadWorkspaces()
  }, [loadWorkspaces])

  const filteredWorkspaces = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return workspaces
    }

    return workspaces.filter((workspace) =>
      [
        workspace.name,
        workspace.identifier,
        workspace.ownerName ?? "",
        workspace.ownerEmail ?? "",
      ].some((value) => value.toLowerCase().includes(normalizedQuery))
    )
  }, [query, workspaces])

  async function handleDeleteWorkspace() {
    if (!deleteTarget) {
      return
    }

    setDeletingId(deleteTarget.id)
    setError(null)

    try {
      const response = await apiFetch(`/api/admin/workspaces/${deleteTarget.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const body = await safeJson(response)
        throw new Error(body?.message ?? "Failed to delete workspace.")
      }

      setWorkspaces((current) =>
        current.filter((workspace) => workspace.id !== deleteTarget.id)
      )
      setDeleteTarget(null)
      setConfirmIdentifier("")
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to delete workspace."
      )
    } finally {
      setDeletingId(null)
    }
  }

  async function handleToggleUploads(workspace: AdminWorkspaceRecord) {
    setUpdatingId(workspace.id)
    setError(null)

    try {
      const response = await apiFetch(`/api/admin/workspaces/${workspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadsPaused: !workspace.uploadsPaused,
          uploadsPausedReason: workspace.uploadsPaused
            ? null
            : "Uploads paused by an administrator.",
        }),
      })

      if (!response.ok) {
        const body = await safeJson(response)
        throw new Error(body?.message ?? "Failed to update upload state.")
      }

      const updated = (await response.json()) as AdminWorkspaceRecord
      setWorkspaces((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      )
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to update workspace upload state."
      )
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <AdminShell
      activeItem="all-workspaces"
      title="All workspaces"
      description="Search every workspace in the instance and remove tenants when needed."
    >
      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Directory</Badge>
            <Badge variant="outline">{workspaces.length} total</Badge>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle>Workspace directory</CardTitle>
              <CardDescription>
                This is the first admin search surface. User search can slot into
                the same category next.
              </CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <Input
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="Search name, identifier, owner, or email"
                className="sm:min-w-80"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadWorkspaces()}
                disabled={loading}
              >
                {loading ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <HugeiconsIcon icon={RefreshIcon} className="size-4" />
                )}
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Workspace directory unavailable</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="overflow-hidden rounded-3xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Uploads</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <Spinner className="size-4" />
                        Loading workspaces...
                      </span>
                    </TableCell>
                  </TableRow>
                ) : filteredWorkspaces.length > 0 ? (
                  filteredWorkspaces.map((workspace) => (
                    <TableRow key={workspace.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{workspace.name}</span>
                          <span className="text-xs text-muted-foreground">
                            @{workspace.identifier}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span>{workspace.ownerName ?? "Unknown owner"}</span>
                          <span className="text-xs text-muted-foreground">
                            {workspace.ownerEmail ?? "No email"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {workspace.storageTier}
                        </Badge>
                      </TableCell>
                      <TableCell>{workspace.memberCount}</TableCell>
                      <TableCell>
                        <Badge
                          variant={workspace.uploadsPaused ? "outline" : "secondary"}
                          className={
                            workspace.uploadsPaused
                              ? "border-destructive/40 text-destructive"
                              : ""
                          }
                        >
                          {workspace.uploadsPaused ? "Paused" : "Enabled"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(workspace.createdAt), {
                          addSuffix: true,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleToggleUploads(workspace)}
                            disabled={updatingId === workspace.id}
                          >
                            {updatingId === workspace.id ? (
                              <Spinner className="size-3.5" />
                            ) : (
                              <HugeiconsIcon icon={StopCircleIcon} className="size-4" />
                            )}
                            {workspace.uploadsPaused ? "Resume uploads" : "Pause uploads"}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setDeleteTarget(workspace)
                              setConfirmIdentifier("")
                            }}
                            disabled={deletingId === workspace.id}
                          >
                            {deletingId === workspace.id ? (
                              <Spinner className="size-3.5" />
                            ) : (
                              <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                            )}
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <HugeiconsIcon icon={SearchList01Icon} className="size-4" />
                        No workspaces match this search.
                      </span>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && deletingId === null) {
            setDeleteTarget(null)
            setConfirmIdentifier("")
          }
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workspace</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <strong>{deleteTarget?.name}</strong> and all
              related data. Type <code>@{deleteTarget?.identifier}</code> to
              confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Input
              value={confirmIdentifier}
              onChange={(event) => setConfirmIdentifier(event.currentTarget.value)}
              placeholder={deleteTarget ? `@${deleteTarget.identifier}` : ""}
              disabled={deletingId !== null}
            />
            <p className="text-xs text-muted-foreground">
              Workspace deletion cascades through members, assets, usage counters,
              and related records.
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void handleDeleteWorkspace()}
              disabled={
                deletingId !== null ||
                confirmIdentifier !== `@${deleteTarget?.identifier ?? ""}`
              }
            >
              {deletingId !== null && <Spinner className="size-3.5" />}
              Delete workspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  )
}

async function safeJson(response: Response): Promise<{ message?: string } | null> {
  try {
    return (await response.json()) as { message?: string }
  } catch {
    return null
  }
}
