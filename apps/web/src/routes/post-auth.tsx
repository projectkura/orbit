import { useEffect } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"

import type { OrbitSessionUser } from "@/lib/auth-types"
import { authClient } from "@/lib/auth-client"
import { Spinner } from "@/components/spinner"

export const Route = createFileRoute("/post-auth")({
  component: PostAuthPage,
})

function PostAuthPage() {
  const session = authClient.useSession()
  const navigate = useNavigate()
  const user = (session.data?.user as OrbitSessionUser | undefined) ?? null

  useEffect(() => {
    if (session.isPending) {
      return
    }

    if (!user) {
      void navigate({ to: "/auth", replace: true })
      return
    }

    void navigate({ to: user.role === "admin" ? "/admin" : "/app", replace: true })
  }, [session.isPending, user, navigate])

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4">
      <Spinner />
      <p className="text-sm text-muted-foreground">Signing you in...</p>
    </main>
  )
}
