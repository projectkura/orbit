import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Link,
  Outlet,
  createFileRoute,
  useLocation,
  useNavigate,
} from "@tanstack/react-router"
import type { WorkspaceSummary } from "@orbit/shared/workspaces"

import type { OrbitSessionUser } from "@/lib/auth-types"
import { apiFetch } from "@/lib/api-client"
import { authClient } from "@/lib/auth-client"
import { onWorkspaceUpdated } from "@/lib/workspace-events"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert"
import { Badge } from "@/components/badge"
import { Button } from "@/components/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/card"
import { Spinner } from "@/components/spinner"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/sidebar"
import { WorkspaceSidebar } from "@/components/features/workspace/sidebar"
import { WorkspaceOnboarding } from "@/components/features/workspace/onboarding"

export const Route = createFileRoute("/app/$identifier")({
  component: WorkspaceLayout,
})

async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text()
  return text ? (JSON.parse(text) as T) : null
}

function WorkspaceLayout() {
  const { identifier } = Route.useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const session = authClient.useSession()
  const user = useMemo(
    () => (session.data?.user as OrbitSessionUser | undefined) ?? null,
    [session.data]
  )
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingChecked, setOnboardingChecked] = useState(false)

  useEffect(() => {
    if (session.isPending) return
    if (!user) {
      void navigate({ to: "/login", replace: true })
      return
    }

    let mounted = true

    async function loadWorkspace() {
      setLoading(true)
      setError(null)

      try {
        const response = await apiFetch(`/api/workspaces/${identifier}`)

        if (response.status === 404) {
          if (mounted) {
            setWorkspace(null)
            setError("Workspace not found or you do not have access to it.")
          }
          return
        }

        if (!response.ok) {
          const body = await readJson<{ message?: string }>(response)
          throw new Error(body?.message ?? "Unable to load workspace.")
        }

        const payload = await readJson<WorkspaceSummary>(response)
        if (mounted) setWorkspace(payload)
      } catch (caughtError) {
        if (mounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load workspace."
          )
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadWorkspace()

    return () => {
      mounted = false
    }
  }, [identifier, navigate, session.isPending, user])

  useEffect(() => {
    if (location.pathname === `/app/${identifier}`) {
      void navigate({
        to: "/app/$identifier/overview",
        params: { identifier },
        replace: true,
      })
    }
  }, [identifier, location.pathname, navigate])

  const handleOnboardingComplete = useCallback(() => {
    localStorage.setItem(`orbit_setup_${identifier}`, "complete")
    setShowOnboarding(false)
  }, [identifier])

  useEffect(() => {
    if (loading || !workspace) return
    const storageKey = `orbit_setup_${identifier}`
    if (localStorage.getItem(storageKey) === "complete") {
      setOnboardingChecked(true)
      return
    }
    void apiFetch(`/api/workspaces/${identifier}/api-keys`)
      .then(async (res) => {
        if (res.ok) {
          const text = await res.text()
          const data = text ? (JSON.parse(text) as { keys: unknown[] }) : null
          if (data && data.keys.length > 0) {
            localStorage.setItem(storageKey, "complete")
            setOnboardingChecked(true)
            return
          }
        }
        setShowOnboarding(true)
        setOnboardingChecked(true)
      })
      .catch(() => {
        setOnboardingChecked(true)
      })
  }, [loading, workspace, identifier])

  useEffect(() => {
    return onWorkspaceUpdated((updatedWorkspace) => {
      if (updatedWorkspace.identifier === identifier) {
        setWorkspace(updatedWorkspace)
      }
    })
  }, [identifier])

  async function handleLogout() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.assign("/")
        },
      },
    })
  }

  if (session.isPending || loading) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4">
        <Spinner className="size-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading workspace...</p>
      </main>
    )
  }

  if (!user) return null

  if (!workspace) {
    return (
      <main className="flex min-h-svh items-center justify-center px-6 py-10">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <Badge variant="outline">Workspace</Badge>
            <CardTitle>Workspace unavailable</CardTitle>
            <CardDescription>
              {error ?? "This workspace could not be found."}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-3 sm:flex-row">
            <Button className="w-full" render={<Link to="/app" />}>
              Back to workspaces
            </Button>
            {user.role === "admin" ? (
              <Button variant="outline" className="w-full" render={<Link to="/admin" />}>
                Open admin dashboard
              </Button>
            ) : null}
          </CardFooter>
        </Card>
      </main>
    )
  }

  let active: "overview" | "usage" | "settings" | "api-keys" = "overview"
  if (location.pathname.endsWith("/usage")) {
    active = "usage"
  } else if (location.pathname.endsWith("/settings")) {
    active = "settings"
  } else if (location.pathname.endsWith("/api-keys")) {
    active = "api-keys"
  }

  const pageInfo: Record<typeof active, { title: string; description: string }> = {
    overview: { title: "Overview", description: "Workspace summary and resources" },
    usage: { title: "Usage", description: "Storage, backups, network, and API consumption" },
    "api-keys": { title: "API Keys", description: "Credentials for server integrations" },
    settings: { title: "Settings", description: "Workspace preferences and configuration" },
  }
  const { title: pageTitle, description: pageDescription } = pageInfo[active]
  const navUser = {
    firstName:
      user.firstName ?? user.name ?? user.username ?? user.email.split("@")[0],
    username: user.username ?? user.email.split("@")[0],
    email: user.email,
    avatar: user.image,
    isAdmin: user.role === "admin",
  }

  return (
    <SidebarProvider>
      <WorkspaceSidebar
        activeItem={active}
        identifier={identifier}
        workspace={workspace}
        user={navUser}
        onLogout={() => void handleLogout()}
      />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 rounded-t-[inherit] border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/70">
          <SidebarTrigger />
          <div className="flex min-w-0 flex-col">
            <p className="truncate text-sm font-medium text-foreground">{pageTitle}</p>
            <p className="truncate text-xs text-muted-foreground">{pageDescription}</p>
          </div>
        </header>

        {showOnboarding ? (
          <WorkspaceOnboarding
            identifier={identifier}
            onComplete={handleOnboardingComplete}
          />
        ) : (
          <div className="p-4 md:p-6">
            {error ? (
              <Alert className="mb-6">
                <AlertTitle>Workspace update</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {onboardingChecked ? <Outlet /> : null}
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}
