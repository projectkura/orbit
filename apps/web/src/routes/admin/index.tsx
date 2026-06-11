import { useEffect, useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { AdminShell } from "@/components/features/admin/shell"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/card"
import { Spinner } from "@/components/spinner"

export const Route = createFileRoute("/admin/")({ component: AdminOverviewPage })

function AdminOverviewPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function checkConfig() {
      try {
        const res = await fetch("/api/instance-config", {
          credentials: "include",
        })

        if (!res.ok) {
          throw new Error(`Failed to load config (${res.status})`)
        }

        const data = (await res.json()) as { onboardingComplete?: boolean }

        if (!mounted) {
          return
        }

        if (!data.onboardingComplete) {
          void navigate({ to: "/admin/onboarding", replace: true })
          return
        }
      } catch (err) {
        console.error("Failed to check onboarding state", err)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void checkConfig()

    return () => {
      mounted = false
    }
  }, [navigate])

  if (loading) {
    return (
      <AdminShell
        activeItem="overview"
        title="Overview"
        description="Orbit instance overview"
      >
        <div className="flex flex-col items-center justify-center py-20">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      </AdminShell>
    )
  }

  return (
    <AdminShell
      activeItem="overview"
      title="Overview"
      description="Orbit instance overview"
    >
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Welcome to Orbit</CardTitle>
            <CardDescription>
              Your instance is configured and ready. Select an option from the sidebar to manage settings, email templates, or users.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </AdminShell>
  )
}
