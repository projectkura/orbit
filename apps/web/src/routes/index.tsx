import { useEffect, useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"

import { Button } from "@/components/button"
import { apiFetch } from "@/lib/api-client"

export const Route = createFileRoute("/")({ component: LandingPage })

function LandingPage() {
  const [homePageEnabled, setHomePageEnabled] = useState(true)

  useEffect(() => {
    let mounted = true

    void apiFetch("/api/public-config")
      .then(async (response) => {
        if (!response.ok) {
          return
        }

        const data = (await response.json()) as { homePageEnabled?: boolean }

        if (mounted && typeof data.homePageEnabled === "boolean") {
          setHomePageEnabled(data.homePageEnabled)
        }
      })
      .catch(() => {})

    return () => {
      mounted = false
    }
  }, [])

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold tracking-tight">Orbit</h1>
      <p className="text-muted-foreground">FiveM admin panel</p>
      {homePageEnabled ? (
        <Button render={<Link to="/auth" />}>Login / setup</Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Public homepage access is disabled for this instance.
        </p>
      )}
    </main>
  )
}
