import { useEffect, useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import type { WorkspaceSummary } from "@orbit/shared/workspaces"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  Folder01Icon,
  Image02Icon,
} from "@hugeicons/core-free-icons"

import { apiFetch } from "@/lib/api-client"
import { Badge } from "@/components/badge"
import { Button } from "@/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/card"
import { Spinner } from "@/components/spinner"

export const Route = createFileRoute("/app/$identifier/overview")({
  component: WorkspaceOverviewPage,
})

async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text()
  return text ? (JSON.parse(text) as T) : null
}

interface LimitInfo {
  limit: number
  used: number
  remaining: number
  resetAt: number
}

interface LimitsResponse {
  limits: {
    apiRequestsPerMinute: number
    apiRequestsPerMonth: number
    networkEgressBytesPerMonth: number
    storageBytesMax: number
  }
  usage: {
    apiRequestsPerMinute: LimitInfo
    apiRequestsPerMonth: LimitInfo
    networkEgressBytesPerMonth: LimitInfo
    storageBytesMax: LimitInfo
  }
}

function WorkspaceOverviewPage() {
  const { identifier } = Route.useParams()
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null)
  const [limits, setLimits] = useState<LimitsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function loadWorkspace() {
      const [wsRes, limitsRes] = await Promise.all([
        apiFetch(`/api/workspaces/${identifier}`),
        apiFetch(`/api/workspaces/${identifier}/limits`),
      ])

      const payload = wsRes.ok ? await readJson<WorkspaceSummary>(wsRes) : null
      const limitsPayload = limitsRes.ok ? await readJson<LimitsResponse>(limitsRes) : null

      if (mounted) {
        setWorkspace(payload)
        setLimits(limitsPayload)
        setLoading(false)
      }
    }

    void loadWorkspace()

    return () => {
      mounted = false
    }
  }, [identifier])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Loading overview...
      </div>
    )
  }

  if (!workspace) return null

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Workspace</Badge>
            <Badge variant="outline">{workspace.storageTier}</Badge>
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {workspace.name}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Workspace-local settings, storage, and future server data live
              under this dashboard.
            </p>
          </div>
        </div>

        <div className="aspect-square overflow-hidden rounded-lg border border-border bg-muted">
          {workspace.imageUrl ? (
            <img src={workspace.imageUrl} alt="" className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center text-muted-foreground">
              <HugeiconsIcon icon={Image02Icon} className="size-10" />
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Identifier</CardDescription>
            <CardTitle className="font-mono text-base">@{workspace.identifier}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Role</CardDescription>
            <CardTitle className="text-base">{workspace.role}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Storage tier</CardDescription>
            <CardTitle className="capitalize text-base">
              {workspace.storageTier}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <HugeiconsIcon icon={Folder01Icon} className="size-5" />
                Rate Limits
              </CardTitle>
              <CardDescription>
                Current API usage against your workspace tier limits.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {limits ? (
              <>
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span className="text-sm text-muted-foreground">API / minute</span>
                  <span className="text-sm font-medium">
                    {limits.usage.apiRequestsPerMinute.used.toLocaleString()} / {limits.limits.apiRequestsPerMinute.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span className="text-sm text-muted-foreground">API / month</span>
                  <span className="text-sm font-medium">
                    {limits.usage.apiRequestsPerMonth.used.toLocaleString()} / {limits.limits.apiRequestsPerMonth.toLocaleString()}
                  </span>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Loading limits...</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <HugeiconsIcon icon={Folder01Icon} className="size-5" />
                Usage
              </CardTitle>
              <CardDescription>
                Review storage consumption and the files counted toward this workspace.
              </CardDescription>
            </div>
            <Button
              className="gap-2"
              render={
                <Link
                  to="/app/$identifier/usage"
                  params={{ identifier: workspace.identifier }}
                />
              }
            >
              Open usage
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              General storage is active now. Bandwidth and database tracking are
              modeled and will appear here as those systems start reporting usage.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
